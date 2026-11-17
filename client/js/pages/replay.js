// 리플레이: 수집된 위치 샘플(2초 간격)을 Canvas 트랙맵에 재생한다. 재생·배속·랩 슬라이더·드라이버 추적·이벤트 타임라인.
// 시계: tRace(ms) = 레이스 시작(라이트 아웃) 기준. 위치 파일의 시간 = tRace + meta.offsetMs.
import { h, mount } from '../dom.js';
import { api, urlParam, setUrlParams } from '../api.js';
import { mountLayout } from '../layout.js';
import { load, tabs, emptyState, errorState, skeleton } from '../ui.js';
import { teamColor } from '../teams.js';

mountLayout('schedule');
const app = document.getElementById('app');
const SPEEDS = [1, 5, 10, 30, 60];
const clock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const MARK = { SAFETY_CAR: ['var(--warn)', '세이프티카/VSC'], RED_FLAG: ['var(--down)', '레드 플래그'], FASTEST_LAP: ['#a855f7', '패스티스트 랩'] };

const head = h('div', { class: 'page-head' });
const body = h('div', { class: 'stack' });
app.append(head, body);
let stop = null; // 이전 레이스의 애니메이션 정리

// 완료 랩 수: 통과 시각 배열(cum[0]=0)에서 t 이하인 마지막 인덱스
const lapsDone = (cum, t) => { let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (cum[m] <= t) lo = m; else hi = m - 1; } return lo; };

async function startReplay(race, races) {
  stop?.();
  const select = h('select', { 'aria-label': '레이스 선택' }, races.map((r) => h('option', { value: r.id, selected: r.id === race.id }, `R${r.round} ${r.name}`)));
  select.addEventListener('change', () => setUrlParams({ race: select.value }));
  mount(head, h('div', null, h('h1', null, `${race.name} 리플레이`),
    h('div', { class: 'sub' }, h('span', { class: 'pill warn' }, '리플레이'), ' 수집된 위치 데이터(2초 간격)를 보간해 재생합니다')), select);

  await load(body, async () => {
    const meta = await api(`/races/${race.id}/replay`);
    const res = await fetch(`/data/replay/${meta.sessionId}.json`);
    if (!res.ok) throw new Error('위치 데이터를 불러오지 못했습니다.');
    return { meta, pos: await res.json() };
  }, ({ meta, pos }) => build(meta, pos), skeleton(8, 40));
}

function build(meta, pos) {
  const codes = meta.drivers.map((d) => d.code).filter((c) => pos.drivers[c]);
  const first = pos.drivers[codes[0]];
  const T = first.map((p) => p[0]); // 모든 드라이버가 같은 시각 배열을 공유한다
  const byCode = new Map(meta.drivers.map((d) => [d.code, d]));
  const leaderEnd = Array.from({ length: meta.totalLaps + 1 }, (_, k) => Math.min(...meta.drivers.map((d) => d.cum[k] ?? Infinity)));

  // 좌표 범위 → 캔버스 변환
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const c of codes) for (const p of pos.drivers[c]) { x0 = Math.min(x0, p[1]); x1 = Math.max(x1, p[1]); y0 = Math.min(y0, p[2]); y1 = Math.max(y1, p[2]); }

  const canvas = h('canvas', { class: 'track', 'aria-label': '트랙맵 리플레이' });
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, scale = 1, ox = 0, oy = 0, bg = null;
  const tx = (x) => ox + (x - x0) * scale, ty = (y) => oy + (y1 - y) * scale; // y축 뒤집기

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  function layout() {
    const dpr = window.devicePixelRatio || 1;
    W = canvas.clientWidth; H = Math.min(Math.round(W * 0.72), 640);
    canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pad = 28;
    scale = Math.min((W - pad * 2) / (x1 - x0), (H - pad * 2) / (y1 - y0));
    ox = (W - (x1 - x0) * scale) / 2; oy = (H - (y1 - y0) * scale) / 2;
    // 트랙 윤곽: 모든 드라이버 궤적을 굵은 선으로 겹쳐 오프스크린에 한 번만 그린다(샘플 위상이 달라 코너가 메워진다).
    bg = document.createElement('canvas'); bg.width = canvas.width; bg.height = canvas.height;
    const b = bg.getContext('2d');
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    b.lineWidth = 9; b.lineCap = 'round'; b.lineJoin = 'round'; b.strokeStyle = css('--border') || '#333';
    for (const c of codes) {
      // 샘플 간격이 약 160m라 직선으로 이으면 코너가 잘린다 → 중간점을 지나는 2차 곡선으로 잇는다.
      let prev = null;
      b.beginPath();
      for (const p of pos.drivers[c]) {
        const X = tx(p[1]), Y = ty(p[2]);
        if (!prev || Math.hypot(p[1] - prev.x, p[2] - prev.y) > 3000) b.moveTo(X, Y); // 300m 넘는 점프(데이터 공백)는 잇지 않는다
        else b.quadraticCurveTo(prev.X, prev.Y, (prev.X + X) / 2, (prev.Y + Y) / 2);
        prev = { x: p[1], y: p[2], X, Y };
      }
      b.stroke();
    }
  }

  let t = 0, playing = false, speed = 10, tracked = null, last = 0, raf = 0;
  const fileT = () => t + meta.offsetMs;
  function at(c, ft) {
    const a = pos.drivers[c];
    let lo = 0, hi = T.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (T[m] <= ft) lo = m; else hi = m - 1; }
    const p = a[lo], q = a[Math.min(lo + 1, a.length - 1)];
    const k = q[0] === p[0] ? 0 : Math.min(1, Math.max(0, (ft - p[0]) / (q[0] - p[0])));
    return [p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k];
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (bg) ctx.drawImage(bg, 0, 0, W, H);
    const ft = fileT();
    ctx.font = '600 10px Inter, sans-serif'; ctx.textBaseline = 'middle';
    // 추적 중인 드라이버를 마지막에 그려 위에 오게 한다
    for (const c of [...codes.filter((x) => x !== tracked), ...(tracked ? [tracked] : [])]) {
      const d = byCode.get(c), [x, y] = at(c, ft), isT = c === tracked;
      ctx.beginPath(); ctx.arc(tx(x), ty(y), isT ? 8 : 5.5, 0, Math.PI * 2);
      ctx.fillStyle = teamColor(d.teamId, d.color); ctx.fill();
      if (isT) { ctx.lineWidth = 2.5; ctx.strokeStyle = css('--text') || '#fff'; ctx.stroke(); }
      if (isT || !tracked) { ctx.fillStyle = css('--text') || '#fff'; ctx.fillText(c, tx(x) + 9, ty(y)); }
    }
  }

  // ---- 컨트롤·순위 패널 ----
  const playBtn = h('button', { class: 'btn', onclick: () => toggle() }, '▶ 재생');
  const lapLabel = h('b', { class: 'num' }, '1'), clockEl = h('span', { class: 'num muted' });
  const slider = h('input', { type: 'range', min: 1, max: meta.totalLaps, value: 1, step: 1, 'aria-label': '랩 슬라이더' });
  slider.addEventListener('input', () => seek(leaderEnd[Number(slider.value) - 1] ?? 0));
  const speedTabs = h('div');
  const renderSpeed = () => mount(speedTabs, tabs(SPEEDS.map((s) => ({ key: s, label: `${s}×` })), speed, (s) => { speed = s; renderSpeed(); }));
  renderSpeed();
  const pill = h('span', { class: 'pill ok' }, '그린');
  const orderList = h('ol', { class: 'order' });
  const trackSel = h('select', { 'aria-label': '드라이버 추적' }, h('option', { value: '' }, '추적 안 함'),
    ...codes.map((c) => h('option', { value: c }, `${c} · ${byCode.get(c).name}`)));
  trackSel.addEventListener('change', () => { tracked = trackSel.value || null; panel(); draw(); });

  const events = meta.events.filter((e) => MARK[e.type]);
  const cursor = h('i', { class: 'cursor' });
  const timeline = h('div', { class: 'timeline', 'aria-label': '이벤트 타임라인' }, cursor, events.map((e) => {
    const label = e.type === 'SAFETY_CAR' ? `${e.lap}랩 ${e.data?.kind ?? ''} ${e.data?.state === 'DEPLOYED' ? '투입' : '해제'}`.trim() : e.type === 'FASTEST_LAP' ? `${e.lap}랩 ${e.driver} 패스티스트 랩` : MARK[e.type][1];
    return h('button', { class: 'mark', style: `left:${(e.t / meta.endMs) * 100}%;background:${MARK[e.type][0]}`, title: label, 'aria-label': label, onclick: () => seek(Math.max(0, e.t - 5000)) });
  }));

  function stateAt() {
    let s = ['그린', 'ok'];
    for (const e of meta.events) {
      if (e.t > t) break;
      if (e.type === 'RED_FLAG') s = ['레드 플래그', 'bad'];
      else if (e.type === 'GREEN_FLAG') s = ['그린', 'ok'];
      else if (e.type === 'SAFETY_CAR') s = e.data?.state === 'DEPLOYED' && /DEPLOYED/.test(e.data?.message ?? 'DEPLOYED') ? [e.data.kind === 'VSC' ? '가상 세이프티카' : '세이프티카', 'warn'] : ['그린', 'ok'];
    }
    return s;
  }
  function panel() {
    const rows = meta.drivers.filter((d) => pos.drivers[d.code]).map((d) => ({ d, n: lapsDone(d.cum, t) }))
      .sort((a, b) => b.n - a.n || (a.n ? a.d.cum[a.n] - b.d.cum[b.n] : (a.d.grid ?? 99) - (b.d.grid ?? 99)));
    orderList.replaceChildren(...rows.map(({ d }, i) => h('li', { class: d.code === tracked ? 'on' : '' },
      h('button', { onclick: () => { tracked = d.code === tracked ? null : d.code; trackSel.value = tracked ?? ''; panel(); draw(); } },
        h('span', { class: 'num' }, i + 1), h('i', { style: `background:${teamColor(d.teamId, d.color)}` }), d.code))));
    const lap = Math.min(meta.totalLaps, lapsDone(leaderEnd, t) + 1);
    lapLabel.textContent = lap; slider.value = lap; clockEl.textContent = `${clock(t)} / ${clock(meta.endMs)}`;
    const [label, kind] = stateAt(); pill.textContent = label; pill.className = `pill ${kind}`;
    cursor.style.left = `${(t / meta.endMs) * 100}%`;
  }

  function seek(ms) { t = Math.min(Math.max(0, ms), meta.endMs); panel(); draw(); }
  function toggle(on = !playing) {
    playing = on; playBtn.textContent = playing ? '⏸ 일시정지' : '▶ 재생';
    if (playing) { if (t >= meta.endMs) t = 0; last = performance.now(); raf = requestAnimationFrame(frame); } else cancelAnimationFrame(raf);
  }
  let sincePanel = 0;
  function frame(now) {
    const dt = now - last; last = now;
    t = Math.min(meta.endMs, t + dt * speed);
    sincePanel += dt;
    draw();
    if (sincePanel > 250 || t >= meta.endMs) { panel(); sincePanel = 0; }
    if (t >= meta.endMs) return toggle(false);
    raf = requestAnimationFrame(frame);
  }

  const onResize = () => { layout(); draw(); };
  window.addEventListener('resize', onResize);
  const themeWatch = new MutationObserver(onResize);
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  stop = () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); themeWatch.disconnect(); };

  const root = h('div', { class: 'stack' },
    h('div', { class: 'filters' }, pill, playBtn, speedTabs, h('span', null, '랩 ', lapLabel, ` / ${meta.totalLaps}`), clockEl, trackSel),
    h('div', { class: 'replay-grid' }, h('div', null, canvas), h('section', null, h('div', { class: 'section-title' }, h('h2', null, '순위')), orderList)),
    h('label', { class: 'toggle' }, '랩 이동', slider),
    h('section', null, h('div', { class: 'section-title' }, h('h2', null, '이벤트 타임라인'),
      h('span', { class: 'muted' }, Object.values(MARK).map(([, l]) => l).join(' · '))), timeline));
  // 캔버스는 DOM에 붙은 뒤에야 폭을 알 수 있다.
  queueMicrotask(() => { layout(); panel(); draw(); });
  return root;
}

async function init() {
  mount(body, skeleton());
  try {
    const { races } = await api('/races', { season: urlParam('season') });
    const list = races.filter((r) => r.collected);
    if (!list.length) return mount(body, emptyState('리플레이 데이터가 수집된 레이스가 없습니다.'));
    startReplay(list.find((r) => r.id === Number(urlParam('race'))) ?? list[0], list);
  } catch (err) {
    mount(body, errorState(err.message, init));
  }
}
init();
