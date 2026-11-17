// 레이스 분석(/strategy.html?race=): 현재는 레이스 페이스 탭. 스틴트·피트스톱 탭은 같은 페이지에 이어 붙인다.
import { h, mount } from '../dom.js';
import { api, urlParam, setUrlParams } from '../api.js';
import { mountLayout } from '../layout.js';
import { load, table, colorBar, emptyState, errorState, skeleton } from '../ui.js';
import { boxPlot } from '../charts/box.js';
import { stripPlot } from '../charts/strip.js';
import { lineChart } from '../chart-line.js';
import { teamColor } from '../teams.js';
import { lapTime } from '../format.js';

mountLayout('schedule');
const app = document.getElementById('app');
const head = h('div', { class: 'page-head' });
const body = h('div', { class: 'stack' });
app.append(head, body);

const block = (title, node, note) => h('section', null, h('div', { class: 'section-title' }, h('h2', null, title), note && h('span', { class: 'muted' }, note)), node);
const sec = (ms) => `${(ms / 1000).toFixed(1)}초`;

function paceView(d) {
  if (!d.drivers.length) return emptyState('이 레이스의 랩 데이터가 없습니다.');
  const color = (x) => teamColor(x.teamId, x.color);
  const withPace = d.drivers.filter((x) => x.medianMs != null).sort((a, b) => a.medianMs - b.medianMs);
  const lapNumbers = Array.from({ length: d.totalLaps }, (_, i) => String(i + 1));
  const toSeries = (key) => d.drivers.map((x) => ({ id: x.id, label: x.code ?? x.name, color: color(x), values: x[key] }));
  const front = d.drivers.slice(0, 5).map((x) => x.id); // 20개 선이 한꺼번에 겹치지 않도록 상위 5명만 켠다.
  const fastest = d.top[0]?.timeMs;

  const topTable = table([
    { label: '#', render: (r) => r.rank },
    { label: '드라이버', render: (r) => h('div', { class: 'who' }, colorBar(color(r)), h('b', null, r.name)) },
    { label: '랩', align: 'right', render: (r) => r.lap },
    { label: '기록', align: 'right', render: (r) => h('span', { class: r.rank === 1 ? 'best' : '' }, lapTime(r.timeMs)) },
    { label: '격차', align: 'right', render: (r) => (r.rank === 1 ? '–' : `+${((r.timeMs - fastest) / 1000).toFixed(3)}`) },
  ], d.top.map((r, i) => ({ ...r, rank: i + 1 })));

  const groups = withPace.map((x) => ({ label: x.code ?? x.name, color: color(x), values: x.times.filter((t) => t != null) }));
  return [
    block('최속 랩 Top 20', topTable, `기준 최속 랩 ${lapTime(d.referenceMs)}`),
    block('Race Pace', boxPlot({ groups, format: lapTime, title: '드라이버별 레이스 페이스 박스플롯' }), '중앙값이 빠른 순'),
    block('Lap Times', stripPlot({ groups, format: lapTime, title: '드라이버별 랩타임 분포' })),
    block('Race Pace Evolution', lineChart({ series: toSeries('times'), xLabels: lapNumbers, visible: front, format: lapTime, title: '랩별 랩타임 선 차트', auto: true, asc: true, left: 76 }), '범례를 눌러 드라이버를 켜고 끕니다'),
    block('Position Evolution', lineChart({ series: toSeries('positions'), xLabels: lapNumbers, visible: front, format: (v) => (v >= 1 ? `${v}위` : ''), title: '랩별 순위 선 차트', invert: true })),
    block('Gap to Leader', lineChart({ series: toSeries('gaps'), xLabels: lapNumbers, visible: front, format: (v) => sec(v), title: '선두 대비 갭 선 차트', invert: true, left: 76 }), '선두와의 누적 시간 차'),
  ];
}

async function init() {
  mount(body, skeleton());
  try {
    const { races } = await api('/races', { season: urlParam('season') });
    const finished = races.filter((r) => r.finished);
    if (!finished.length) return mount(body, emptyState('결과가 있는 레이스가 없습니다.'));
    const race = finished.find((r) => r.id === Number(urlParam('race'))) ?? finished.at(-1);
    const clean = urlParam('clean') !== 'false';
    const cutoff = Number(urlParam('cutoff')) || 107;

    const select = h('select', { 'aria-label': '레이스 선택' }, finished.map((r) => h('option', { value: r.id, selected: r.id === race.id }, `R${r.round} ${r.name}`)));
    select.addEventListener('change', () => setUrlParams({ race: select.value }));
    mount(head, h('div', null, h('h1', null, `${race.name} 레이스 페이스`), h('div', { class: 'sub' }, `${race.circuit_name ?? ''} · ${race.season} 시즌 ${race.round}라운드`)), select);

    const cutoffLabel = h('b', null, `${cutoff}%`);
    const slider = h('input', { type: 'range', min: 101, max: 150, value: cutoff, 'aria-label': '이상치 컷오프(%)', disabled: !clean });
    slider.addEventListener('input', () => { cutoffLabel.textContent = `${slider.value}%`; });
    slider.addEventListener('change', () => setUrlParams({ cutoff: slider.value }));
    const filters = h('div', { class: 'filters' },
      h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: clean, onchange: (e) => setUrlParams({ clean: e.target.checked ? null : 'false' }) }), '클린랩만'),
      h('label', { class: 'toggle' }, '컷오프(최속 랩 대비)', slider, cutoffLabel),
      h('span', { class: 'muted' }, clean ? '1랩·인랩·아웃랩과 컷오프 초과 랩(세이프티카 등)을 제외합니다.' : '모든 랩을 포함합니다.'));
    const content = h('div', { class: 'stack' });
    mount(body, filters, content);
    await load(content, () => api(`/races/${race.id}/pace`, { clean, cutoff }), paceView);
  } catch (err) {
    mount(body, errorState(err.message, init));
  }
}
init();
