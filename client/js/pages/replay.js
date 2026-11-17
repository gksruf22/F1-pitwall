// 리플레이: 수집된 위치 샘플(2초 간격)을 Canvas 트랙맵에 재생한다. 재생·배속·랩 슬라이더·드라이버 추적·이벤트 타임라인.
// 시계: tRace(ms) = 레이스 시작(라이트 아웃) 기준. 위치 파일의 시간 = tRace + meta.offsetMs.
import { h, mount } from '../dom.js';
import { api, urlParam, setUrlParams } from '../api.js';
import { mountLayout } from '../layout.js';
import { load, tabs, emptyState, errorState, skeleton } from '../ui.js';
import { teamColor } from '../teams.js';
import { trackMap } from '../trackmap.js';

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
  const map = trackMap(pos, meta.drivers);
  const { canvas, codes } = map;
  const byCode = new Map(meta.drivers.map((d) => [d.code, d]));
  const leaderEnd = Array.from({ length: meta.totalLaps + 1 }, (_, k) => Math.min(...meta.drivers.map((d) => d.cum[k] ?? Infinity)));

  let t = 0, playing = false, speed = 10, tracked = null, last = 0, raf = 0;
  const draw = () => map.draw(t + meta.offsetMs, tracked);

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

  stop = () => { cancelAnimationFrame(raf); map.destroy(); };

  const root = h('div', { class: 'stack' },
    h('div', { class: 'filters' }, pill, playBtn, speedTabs, h('span', null, '랩 ', lapLabel, ` / ${meta.totalLaps}`), clockEl, trackSel),
    h('div', { class: 'replay-grid' }, h('div', null, canvas), h('section', null, h('div', { class: 'section-title' }, h('h2', null, '순위')), orderList)),
    h('label', { class: 'toggle' }, '랩 이동', slider),
    h('section', null, h('div', { class: 'section-title' }, h('h2', null, '이벤트 타임라인'),
      h('span', { class: 'muted' }, Object.values(MARK).map(([, l]) => l).join(' · '))), timeline));
  // 캔버스는 DOM에 붙은 뒤에야 폭을 알 수 있다.
  queueMicrotask(() => { map.layout(); panel(); });
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
