// 라이브 타이밍(시뮬레이션): 서버가 SSE로 보내는 과거 레이스 순위표·이벤트를 그대로 그린다. 실제 실시간 데이터가 아니다.
import { h, mount } from '../dom.js';
import { api, urlParam, setUrlParams } from '../api.js';
import { mountLayout } from '../layout.js';
import { table, tabs, colorBar, emptyState, errorState, skeleton } from '../ui.js';
import { teamColor } from '../teams.js';
import { lapTime } from '../format.js';

mountLayout('schedule');
const app = document.getElementById('app');
const SPEEDS = [1, 10, 30, 60, 120];
const speed = SPEEDS.includes(Number(urlParam('speed'))) ? Number(urlParam('speed')) : 30;
const STATE = { GREEN: ['그린', 'ok'], SC: ['세이프티카', 'warn'], VSC: ['가상 세이프티카', 'warn'], RED: ['레드 플래그', 'bad'], FINISHED: ['종료', ''] };
const TYRE = { SOFT: ['S', '#e10600'], MEDIUM: ['M', '#f5c400'], HARD: ['H', '#e5e5e5'], INTERMEDIATE: ['I', '#2bb24c'], WET: ['W', '#2f7de1'] };

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
  { label: '타이어', render: (r) => { const [l, c] = TYRE[r.tyre] ?? ['?', '#888']; return h('span', { class: 'tyre', style: `border-color:${c}` }, l); } },
  { label: '피트', align: 'right', render: (r) => r.pits },
];

const head = h('div', { class: 'page-head' });
const body = h('div', { class: 'stack' });
app.append(head, body);
let source = null;

function start(race, races) {
  const select = h('select', { 'aria-label': '레이스 선택' }, races.map((r) => h('option', { value: r.id, selected: r.id === race.id }, `R${r.round} ${r.name}`)));
  select.addEventListener('change', () => setUrlParams({ race: select.value }));
  mount(head, h('div', null, h('h1', null, `${race.name} 라이브 타이밍`),
    h('div', { class: 'sub' }, h('span', { class: 'pill warn' }, '시뮬레이션'), ' 과거 레이스를 재생합니다(실제 실시간 데이터 아님)')), select);

  const pill = h('span', { class: 'pill' }, '연결 중');
  const lapEl = h('b', { class: 'num' }, '–'), clockEl = h('span', { class: 'num muted' }, '0:00:00');
  const tbody = h('div', null, skeleton(8, 32));
  const feed = h('ul', { class: 'feed', 'aria-live': 'polite' });
  const bar = h('div', { class: 'filters' }, pill, h('span', null, '랩 ', lapEl), clockEl,
    tabs(SPEEDS.map((s) => ({ key: s, label: `${s}×` })), speed, (s) => setUrlParams({ speed: s })));
  mount(body, bar, h('div', { class: 'live-grid' }, tbody, h('section', null, h('div', { class: 'section-title' }, h('h2', null, '이벤트')), feed)));

  source?.close();
  source = new EventSource(`/api/races/${race.id}/stream?speed=${speed}`);
  let ended = false;
  source.addEventListener('hello', (e) => { lapEl.after(` / ${JSON.parse(e.data).totalLaps}`); });
  source.addEventListener('tick', (e) => {
    const d = JSON.parse(e.data);
    const [label, kind] = STATE[d.state] ?? [d.state, ''];
    pill.textContent = label; pill.className = `pill ${kind}`;
    lapEl.textContent = d.lap; clockEl.textContent = clock(d.t);
    mount(tbody, table(columns, d.board));
  });
  source.addEventListener('race-event', (e) => {
    const ev = JSON.parse(e.data);
    feed.prepend(h('li', null, h('span', { class: 'muted num' }, `${ev.lap ? `${ev.lap}랩` : ''} `), eventText(ev)));
    while (feed.children.length > 40) feed.lastChild.remove();
  });
  source.addEventListener('end', () => { ended = true; source.close(); });
  source.onerror = () => {
    if (ended) return;
    source.close(); // 자동 재연결하면 처음부터 다시 시작하므로 직접 다시 시도하게 한다.
    mount(body, errorState('연결이 끊어졌습니다.', () => start(race, races)));
  };
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
