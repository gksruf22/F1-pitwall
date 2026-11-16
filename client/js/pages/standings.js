// 순위 페이지: 드라이버/컨스트럭터 탭, 라운드 선택, 포인트 표(격차·변동), 누적 포인트 추이 차트.
import { h } from '../dom.js';
import { api, urlParam, setUrlParams } from '../api.js';
import { mountLayout, sectionTabs } from '../layout.js';
import { load, table, tabs, colorBar, change, emptyState } from '../ui.js';
import { lineChart } from '../chart-line.js';
import { teamColor } from '../teams.js';
import { points } from '../format.js';

mountLayout('schedule');
const app = document.getElementById('app');
const kind = urlParam('tab') === 'constructors' ? 'constructors' : 'drivers';
const head = h('div', { class: 'page-head' });
const body = h('div', { class: 'stack' });
app.append(head, sectionTabs('standings'), body);

const columns = (isDriver) => [
  { label: '순위', render: (r) => h('span', { class: 'pos num' }, r.position) },
  { label: isDriver ? '드라이버' : '팀', render: (r) => h('div', { class: 'who' }, colorBar(teamColor(isDriver ? r.teamId : r.id, r.color)), h('b', null, r.name)) },
  isDriver && { label: '팀', render: (r) => r.teamName ?? '–', class: 'muted' },
  { label: '포인트', align: 'right', render: (r) => h('b', null, points(r.points)) },
  { label: '우승', align: 'right', render: (r) => r.wins },
  { label: '리더와 격차', align: 'right', render: (r) => (r.gapToLeader ? `-${points(r.gapToLeader)}` : '–') },
  { label: '변동', align: 'right', render: (r) => change(r.change) },
].filter(Boolean);

// 같은 팀 드라이버는 색이 같으므로 두 번째 선은 점선으로 구분한다.
function chartSeries(history, isDriver) {
  const seen = new Map();
  return history.map((x) => {
    const teamId = isDriver ? x.teamId : x.id;
    const n = seen.get(teamId) ?? 0;
    seen.set(teamId, n + 1);
    return { id: x.id, label: x.code ?? x.name, color: teamColor(teamId, x.color), dashed: n > 0, values: x.points };
  });
}

load(body, async () => {
  const season = urlParam('season');
  const round = urlParam('round');
  const [data, summary] = await Promise.all([
    api(`/standings/${kind}`, { season, round }),
    api('/races', { season }),
  ]);
  return { data, races: summary.races };
}, ({ data, races }) => {
  const isDriver = kind === 'drivers';
  const done = races.filter((r) => r.finished);
  const select = h('select', { 'aria-label': '라운드 선택' },
    done.map((r) => h('option', { value: r.round, selected: r.round === data.round }, `R${r.round} 이후 · ${r.name}`)));
  select.addEventListener('change', () => setUrlParams({ round: select.value }));

  // 차트용 시리즈에 드라이버의 소속 팀 id를 붙인다(색 결정에 필요).
  const teamOf = new Map(data.standings.map((e) => [e.id, e.teamId]));
  const history = data.history.map((x) => ({ ...x, teamId: teamOf.get(x.id) }));
  const topIds = history.slice(0, isDriver ? 5 : 11).map((x) => x.id);

  head.replaceChildren(h('div', null, h('h1', null, `${data.season} ${isDriver ? '드라이버' : '컨스트럭터'} 순위`),
    h('div', { class: 'sub' }, `${data.round}라운드 종료 기준`)), select);

  return [
    tabs([{ key: 'drivers', label: '드라이버' }, { key: 'constructors', label: '컨스트럭터' }], kind, (k) => setUrlParams({ tab: k })),
    data.standings.length ? table(columns(isDriver), data.standings) : emptyState('순위 데이터가 없습니다.'),
    h('section', null, h('div', { class: 'section-title' }, h('h2', null, '누적 포인트 추이')),
      lineChart({ series: chartSeries(history, isDriver), xLabels: data.rounds.map((n) => `R${n}`), visible: topIds })),
  ];
});
