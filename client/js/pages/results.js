// 결과 페이지: 레이스 선택 + 세션 탭(결승·예선·스프린트). race 파라미터가 없으면 가장 최근 완료 레이스.
import { h, mount } from '../dom.js';
import { api, urlParam, setUrlParams } from '../api.js';
import { mountLayout, sectionTabs } from '../layout.js';
import { load, table, tabs, colorBar, emptyState, errorState, skeleton } from '../ui.js';
import { teamColor } from '../teams.js';
import { lapTime, points, SESSION_NAMES } from '../format.js';

mountLayout('schedule');
const app = document.getElementById('app');
const head = h('div', { class: 'page-head' });
const body = h('div');
app.append(head, sectionTabs('results'), body);

const driverCell = (r) => h('div', { class: 'who' }, colorBar(teamColor(r.teamId, r.color)), h('b', null, r.driverName));

// 결승·스프린트: 그리드 대비 순위 변동과 패스티스트랩 배지를 함께 보여 준다.
const raceColumns = [
  { label: '순위', render: (r) => h('span', { class: 'pos num' }, r.position ?? '–') },
  { label: '드라이버', render: driverCell },
  { label: '팀', render: (r) => r.teamName ?? '–', class: 'muted' },
  { label: '그리드', align: 'right', render: (r) => r.grid || 'PL' },
  { label: '변동', align: 'right', render: (r) => {
    if (!r.grid || !r.position) return h('span', { class: 'muted' }, '–');
    const d = r.grid - r.position;
    return d ? h('span', { class: d > 0 ? 'up' : 'down' }, `${d > 0 ? '▲' : '▼'}${Math.abs(d)}`) : h('span', { class: 'muted' }, '–');
  } },
  { label: '패스티스트랩', align: 'right', render: (r) => r.fastestLapMs
    ? h('span', { class: r.fastestRank === 1 ? 'best' : 'muted' }, lapTime(r.fastestLapMs)) : '–' },
  { label: '포인트', align: 'right', render: (r) => (r.points ? points(r.points) : '–') },
  { label: '상태', render: (r) => r.status ?? '–', class: 'muted' },
];

// 예선: 각 단계의 시간. 가장 빠른 값(전체 최고)은 보라색으로 표시.
function qualiColumns(rows) {
  const best = (k) => Math.min(...rows.map((r) => r[k]).filter((v) => v != null));
  const cell = (k) => (r) => (r[k] == null ? '–' : h('span', { class: r[k] === best(k) ? 'best' : '' }, lapTime(r[k])));
  return [
    { label: '순위', render: (r) => h('span', { class: 'pos num' }, r.position ?? '–') },
    { label: '드라이버', render: driverCell },
    { label: '팀', render: (r) => r.teamName ?? '–', class: 'muted' },
    { label: 'Q1', align: 'right', render: cell('q1Ms') },
    { label: 'Q2', align: 'right', render: cell('q2Ms') },
    { label: 'Q3', align: 'right', render: cell('q3Ms') },
  ];
}

async function init() {
  mount(body, skeleton());
  try {
    const season = urlParam('season');
    const { races } = await api('/races', { season });
    const finished = races.filter((r) => r.finished);
    if (!finished.length) return mount(body, emptyState('결과가 있는 레이스가 없습니다.'));
    const id = Number(urlParam('race')) || finished.at(-1).id;
    const race = races.find((r) => r.id === id) ?? finished.at(-1);
    const type = urlParam('session') ?? 'R';

    const select = h('select', { 'aria-label': '레이스 선택' }, finished.map((r) =>
      h('option', { value: r.id, selected: r.id === race.id }, `R${r.round} ${r.name}`)));
    select.addEventListener('change', () => setUrlParams({ race: select.value, session: null }));
    mount(head, h('div', null, h('h1', null, race.name), h('div', { class: 'sub' }, `${race.circuit_name ?? ''} · ${race.season} 시즌 ${race.round}라운드`)), h('div', { class: 'row-gap' }, h('a', { class: 'btn', href: `/strategy.html?race=${race.id}` }, '레이스 페이스'), race.collected && h('a', { class: 'btn', href: `/live.html?race=${race.id}` }, '라이브(시뮬)'), race.collected && h('a', { class: 'btn', href: `/replay.html?race=${race.id}` }, '리플레이'), select));

    const types = (race.sessions ?? []).map((x) => x.type).filter((t) => t !== 'SQ');
    const order = ['R', 'Q', 'S'].filter((t) => types.includes(t));
    const tabBar = tabs(order.map((t) => ({ key: t, label: SESSION_NAMES[t] })), type, (t) => setUrlParams({ session: t }));
    const content = h('div');
    mount(body, tabBar, content);
    await load(content, () => api(`/races/${race.id}/results`, { session: type }), ({ results }) =>
      results.length ? table(type === 'Q' ? qualiColumns(results) : raceColumns, results) : emptyState('이 세션의 결과가 없습니다.'));
  } catch (err) {
    mount(body, errorState(err.message, init));
  }
}
init();
