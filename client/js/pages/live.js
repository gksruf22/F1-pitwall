// 라이브 타이밍(시뮬레이션): 서버가 SSE로 보내는 과거 레이스 순위표·이벤트를 그대로 그린다. 실제 실시간 데이터가 아니다.
import { h, mount } from '../dom.js';
import { api, urlParam, setUrlParams } from '../api.js';
import { mountLayout, raceTabs } from '../layout.js';
import { table, tabs, colorBar, emptyState, errorState, skeleton } from '../ui.js';
import { teamColor } from '../teams.js';
import { trackMap } from '../trackmap.js';
import { tyreInfo } from '../tyre.js';
import { lapTime } from '../format.js';

mountLayout('schedule');
const app = document.getElementById('app');
const SPEEDS = [1, 10, 30, 60, 120];
let speed = SPEEDS.includes(Number(urlParam('speed'))) ? Number(urlParam('speed')) : 30;
const STATE = { GREEN: ['그린', 'ok'], SC: ['세이프티카', 'warn'], VSC: ['가상 세이프티카', 'warn'], RED: ['레드 플래그', 'bad'], FINISHED: ['종료', ''] };

const clock = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const eventText = (e) => {
  const d = e.data ?? {};
  switch (e.type) {
    case 'GREEN_FLAG': return '그린 플래그';
    case 'RED_FLAG': return '레드 플래그';
    case 'SAFETY_CAR': {
      const name = d.kind === 'VSC' ? '가상 세이프티카' : '세이프티카';
      return d.state === 'DEPLOYED' && /DEPLOYED/.test(d.message ?? 'DEPLOYED') ? `${name} 투입` : `${name} 종료${d.kind === 'VSC' ? '' : ' 예고'}`;
    }
    case 'PIT_IN': return `${e.driver} 피트 인${d.stopMs ? ` (정지 ${(d.stopMs / 1000).toFixed(1)}초)` : ''}`;
    case 'PIT_OUT': return `${e.driver} 피트 아웃`;
    case 'FASTEST_LAP': return `${e.driver} 패스티스트 랩 ${lapTime(d.ms)}`;
    default: return e.type;
  }
};

const gapText = (r) => (r.pos === 1 ? '선두' : r.lapsDown ? `+${r.lapsDown}랩` : r.gapMs == null ? '–' : `+${(r.gapMs / 1000).toFixed(3)}`);
const columns = [
  { label: '순위', render: (r) => h('span', { class: 'pos num' }, r.pos) },
  { label: '드라이버', render: (r) => h('div', { class: 'who' }, colorBar(teamColor(r.teamId, r.color)), h('b', null, r.code),
    r.grid && r.laps ? h('span', { class: r.grid > r.pos ? 'up' : r.grid < r.pos ? 'down' : 'muted' }, r.grid === r.pos ? '–' : `${r.grid > r.pos ? '▲' : '▼'}${Math.abs(r.grid - r.pos)}`) : null) },
  { label: '랩', align: 'right', render: (r) => r.laps },
  { label: '선두와', align: 'right', render: (r) => (r.out ? 'OUT' : gapText(r)) },
  { label: '앞 차와', align: 'right', render: (r) => (r.intervalMs == null ? '–' : `+${(r.intervalMs / 1000).toFixed(3)}`), class: 'muted' },
  { label: '직전 랩', align: 'right', render: (r) => (r.lastMs == null ? '–' : h('span', { class: r.lastMs === r.bestMs ? (r.overallBest ? 'best' : 'up') : '' }, lapTime(r.lastMs))) },
  { label: '최고 랩', align: 'right', render: (r) => (r.bestMs == null ? '–' : lapTime(r.bestMs)), class: 'muted' },
  { label: '타이어', render: (r) => { const [l, c] = tyreInfo(r.tyre); return h('span', { class: 'tyre', style: `border-color:${c}` }, l); } },
  { label: '피트', align: 'right', render: (r) => r.pits },
];

const head = h('div', { class: 'page-head' });
const body = h('div', { class: 'stack' });
const nav = h('div');
app.append(head, nav, body);
let source = null, stopMap = null;

function start(race, races) {
  const select = h('select', { 'aria-label': '레이스 선택' }, races.map((r) => h('option', { value: r.id, selected: r.id === race.id }, `R${r.round} ${r.name}`)));
  select.addEventListener('change', () => setUrlParams({ race: select.value }));
  mount(head, h('div', null, h('h1', null, `${race.name} 라이브 타이밍`),
    h('div', { class: 'sub' }, h('span', { class: 'pill warn' }, '시뮬레이션'), ' 과거 레이스를 재생합니다(실제 실시간 데이터 아님)')), select);

  mount(nav, raceTabs('live', race));
  const pill = h('span', { class: 'pill' }, '연결 중');
  const lapEl = h('b', { class: 'num' }, '–'), clockEl = h('span', { class: 'num muted' }, '0:00:00');
  const tbody = h('div', null, skeleton(8, 32));
  const feed = h('ul', { class: 'feed', 'aria-live': 'polite' });
  const totalEl = h('span'), speedBox = h('div');
  const renderSpeed = () => mount(speedBox, tabs(SPEEDS.map((s) => ({ key: s, label: `${s}×` })), speed, changeSpeed));
  const bar = h('div', { class: 'filters' }, pill, h('span', null, '랩 ', lapEl, totalEl), clockEl, speedBox);
  const mapBox = h('section', { hidden: true });
  mount(body, bar, h('div', { class: 'live-grid' }, tbody, h('div', { class: 'stack' }, mapBox,
    h('section', null, h('div', { class: 'section-title' }, h('h2', null, '이벤트')), feed))));

  // 트랙맵: 위치 파일(리플레이와 같은 데이터)을 받아 서버 시각 t에 맞춰 그린다. 실패해도 순위표는 계속 동작한다.
  // 틱은 1초마다 오고 배속이 높으면 한 번에 수십 초를 건너뛰므로, 틱 사이는 같은 배속으로 시각을 보간한다.
  stopMap?.();
  let tickT = 0, tickAt = performance.now(), raf = 0, stopped = false, map = null, offsetMs = 0, loop = () => {};
  stopMap = () => { stopped = true; cancelAnimationFrame(raf); map?.destroy(); };
  (async () => {
    try {
      const meta = await api(`/races/${race.id}/replay`);
      const res = await fetch(`/data/replay/${meta.sessionId}.json`);
      if (!res.ok || stopped) return;
      map = trackMap(await res.json(), meta.drivers, { labels: false, dot: 4 });
      offsetMs = meta.offsetMs;
      mapBox.append(h('div', { class: 'section-title' }, h('h2', null, '트랙')), map.canvas);
      mapBox.hidden = false;
      map.layout();
      loop = () => {
        map.draw(tickT + Math.min((performance.now() - tickAt) * speed, speed * 1000) + offsetMs);
        raf = requestAnimationFrame(loop);
      };
      loop();
    } catch { /* 트랙맵 없이 진행 */ }
  })();

  // 배속을 바꿔도 페이지를 새로고침하지 않는다: 현재 시각(start)부터 같은 스트림을 새 배속으로 다시 연결한다.
  let ended = false;
  const seen = new Set(); // 재연결 때 겹치는 이벤트가 피드에 두 번 들어가지 않게 한다
  function connect(fromSec) {
    source?.close();
    ended = false;
    source = new EventSource(`/api/races/${race.id}/stream?speed=${speed}${fromSec ? `&start=${fromSec}` : ''}`);
    source.addEventListener('hello', (e) => { totalEl.textContent = ` / ${JSON.parse(e.data).totalLaps}`; });
    source.addEventListener('tick', (e) => {
      const d = JSON.parse(e.data);
      const [label, kind] = STATE[d.state] ?? [d.state, ''];
      pill.textContent = label; pill.className = `pill ${kind}`;
      tickT = d.t; tickAt = performance.now();
      lapEl.textContent = d.lap; clockEl.textContent = clock(d.t);
      mount(tbody, table(columns, d.board));
    });
    source.addEventListener('race-event', (e) => {
      const ev = JSON.parse(e.data);
      const key = `${ev.t}:${ev.type}:${ev.driver}`;
      if (seen.has(key)) return;
      seen.add(key);
      feed.prepend(h('li', null, h('span', { class: 'muted num' }, `${ev.lap ? `${ev.lap}랩` : ''} `), eventText(ev)));
      while (feed.children.length > 40) feed.lastChild.remove();
    });
    source.addEventListener('end', () => { ended = true; source.close(); setTimeout(() => cancelAnimationFrame(raf), 1500); });
    source.onerror = () => {
      if (ended) return;
      source.close(); // 자동 재연결하면 처음부터 다시 시작하므로 직접 다시 시도하게 한다.
      mount(body, errorState('연결이 끊어졌습니다.', () => start(race, races)));
    };
  }
  function changeSpeed(s) {
    if (s === speed) return;
    const from = ended ? 0 : Math.floor(tickT / 1000); // 끝난 뒤에 바꾸면 처음부터 다시 재생
    speed = s;
    const q = new URLSearchParams(location.search); q.set('speed', s);
    history.replaceState(null, '', `?${q}`); // 새로고침해도 같은 배속을 유지한다
    renderSpeed();
    if (from === 0) { seen.clear(); feed.replaceChildren(); tickT = 0; }
    cancelAnimationFrame(raf);
    if (map) loop();
    connect(from);
  }
  renderSpeed();
  connect(0);
}

async function init() {
  mount(body, skeleton());
  try {
    const { races } = await api('/races', { season: urlParam('season') });
    const list = races.filter((r) => r.collected);
    if (!list.length) return mount(body, emptyState('라이브 시뮬레이션 데이터가 수집된 레이스가 없습니다.'));
    start(list.find((r) => r.id === Number(urlParam('race'))) ?? list[0], list);
  } catch (err) {
    mount(body, errorState(err.message, init));
  }
}
init();
