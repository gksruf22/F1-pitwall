// 레이스 분석(/strategy.html?tab=pace|stint|pit): 레이스 페이스(레이스 단위)·스틴트·스피드트랩(수집 3건)·피트스톱 통계(시즌 단위).
import { h, mount } from '../dom.js';
import { api, urlParam, setUrlParams } from '../api.js';
import { mountLayout, raceTabs } from '../layout.js';
import { load, table, colorBar, emptyState, errorState, skeleton } from '../ui.js';
import { barChart } from '../charts/bar.js';
import { gantt } from '../charts/gantt.js';
import { heatmap } from '../charts/heatmap.js';
import { tyreInfo, TYRE } from '../tyre.js';
import { boxPlot } from '../charts/box.js';
import { stripPlot } from '../charts/strip.js';
import { lineChart } from '../chart-line.js';
import { teamColor } from '../teams.js';
import { lapTime } from '../format.js';

mountLayout('schedule');
const app = document.getElementById('app');
const head = h('div', { class: 'page-head' });
const body = h('div', { class: 'stack' });
const tab = ['pit', 'stint'].includes(urlParam('tab')) ? urlParam('tab') : 'pace';
const nav = h('div');
app.append(head, nav, body);

const block = (title, node, note) => h('section', null, h('div', { class: 'section-title' }, h('h2', null, title), note && h('span', { class: 'muted' }, note)), node);
const sec = (ms) => `${(ms / 1000).toFixed(1)}초`;
const signed = (ms, d = 1) => `${ms >= 0 ? '+' : '−'}${Math.abs(ms / 1000).toFixed(d)}초`;
const stat = (label, value, note) => h('div', { class: 'card' }, h('div', { class: 'label' }, label), h('div', { class: 'big num' }, value), note && h('div', { class: 'muted' }, note));

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

// 스틴트·스피드트랩(수집 3건, OpenF1): 드라이버별 타이어 전략 막대 + 컴파운드 요약 + 스피드트랩 Top 15와 순위 분포.
function stintView(d) {
  if (!d.drivers.length) return emptyState('이 레이스의 스틴트 데이터가 없습니다.');
  const color = (x) => teamColor(x.teamId, x.color);
  const rows = d.drivers.map((x) => ({
    label: x.code ?? x.name,
    segs: x.stints.filter((s) => s.from != null).map((s) => {
      const to = s.to ?? d.totalLaps, [abbr, c, name] = tyreInfo(s.compound);
      const pit = x.pits.find((p) => p.stopMs != null && Math.abs(p.lap - to) <= 1);
      return { from: s.from, to, color: c, text: abbr, tip: [`${x.name} · 스틴트 ${s.no}`, `${name} · ${s.from}~${to}랩 (${to - s.from + 1}랩)`, pit && `다음 피트 정지 ${(pit.stopMs / 1000).toFixed(1)}초`].filter(Boolean) };
    }),
  }));
  const stats = Object.keys(TYRE).map((k) => {
    const len = d.drivers.flatMap((x) => x.stints.filter((s) => s.compound === k && s.from != null).map((s) => (s.to ?? d.totalLaps) - s.from + 1));
    return { k, n: len.length, avg: len.length ? len.reduce((a, b) => a + b, 0) / len.length : null };
  }).filter((r) => r.n);
  const statTable = table([
    { label: '타이어', render: (r) => h('div', { class: 'who' }, h('span', { class: 'tyre', style: `border-color:${tyreInfo(r.k)[1]}` }, tyreInfo(r.k)[0]), h('b', null, tyreInfo(r.k)[2])) },
    { label: '스틴트 수', align: 'right', render: (r) => r.n },
    { label: '평균 길이', align: 'right', render: (r) => `${r.avg.toFixed(1)}랩` },
  ], stats);

  const st = d.speedTrap;
  const topTable = table([
    { label: '#', render: (r) => r.rank },
    { label: '드라이버', render: (r) => h('div', { class: 'who' }, colorBar(color(r)), h('b', null, r.name)) },
    { label: '팀', render: (r) => r.teamName ?? '–', class: 'muted' },
    { label: '랩', align: 'right', render: (r) => r.lap },
    { label: '최고 속도', align: 'right', render: (r) => h('span', { class: r.rank === 1 ? 'best' : '' }, `${r.kmh} km/h`) },
  ], st.top.map((r, i) => ({ ...r, rank: i + 1 })));

  return [
    h('p', { class: 'muted' }, 'OpenF1로 수집한 레이스 3건만 제공합니다. 막대에 마우스를 올리면 구간과 피트 정지 시간이 보입니다.'),
    block('타이어 전략', gantt({ rows, total: d.totalLaps, title: '드라이버별 스틴트 전략' }), '결승 순위 순 · S 소프트 / M 미디엄 / H 하드'),
    block('컴파운드 요약', statTable),
    st.top.length ? block('스피드트랩 Top 15', topTable, '드라이버별 최고 속도') : null,
    st.top.length ? block('스피드트랩 순위 분포', heatmap({ rows: st.ranks.map((r) => r.code), cols: Array.from({ length: 10 }, (_, i) => `${i + 1}위`), values: st.ranks.map((r) => r.counts.map((c) => c || null)), format: (v) => `${v}회`, title: '스피드트랩 순위 분포 히트맵' }), '랩마다 그 랩 기록이 있는 드라이버끼리 순위를 매겨 센 횟수') : null,
  ];
}

// 피트스톱 통계(시즌). 값은 Jolpica의 피트레인 "통과 시간"(정지 시간 아님). 팀·드라이버 비교는 레이스 중앙값 대비.
function pitView(d) {
  const c = d.cards;
  if (!c.total) return emptyState('이 시즌의 피트스톱 데이터가 없습니다.');
  const color = (x) => teamColor(x.teamId ?? x.id, x.color);
  const who = (r) => h('div', { class: 'who' }, colorBar(color(r)), h('b', null, r.driverName ?? r.name));
  const teamSeries = d.teams.map((t) => ({ id: t.id, label: t.name, color: color(t), values: d.rounds.map((r) => r.teams[t.id] ?? null) }));
  const slowest = (list) => Math.min(...list.map((x) => x.avgDelta));
  const bars = (list, label) => list.map((x) => ({ label: label(x), value: x.avgDelta - slowest(list), color: color(x) }));
  const plus = (v) => `+${(v / 1000).toFixed(2)}초`;

  const topTable = table([
    { label: '#', render: (r) => r.rank },
    { label: '드라이버', render: who },
    { label: '팀', render: (r) => r.teamName ?? '–', class: 'muted' },
    { label: '레이스', render: (r) => `R${r.round} ${r.raceName}`, class: 'muted' },
    { label: '랩', align: 'right', render: (r) => r.lap },
    { label: '통과 시간', align: 'right', render: (r) => h('span', { class: r.rank === 1 ? 'best' : '' }, `${(r.laneMs / 1000).toFixed(3)}초`) },
  ], d.top.map((r, i) => ({ ...r, rank: i + 1 })));

  const stopTable = d.stopTimes.length && table([
    { label: '#', render: (r) => r.rank },
    { label: '드라이버', render: who },
    { label: '팀', render: (r) => r.teamName ?? '–', class: 'muted' },
    { label: '레이스', render: (r) => r.raceName, class: 'muted' },
    { label: '랩', align: 'right', render: (r) => r.lap },
    { label: '정지 시간', align: 'right', render: (r) => h('span', { class: r.rank === 1 ? 'best' : '' }, `${(r.stopMs / 1000).toFixed(2)}초`) },
  ], d.stopTimes.map((r, i) => ({ ...r, rank: i + 1 })));

  return [
    h('p', { class: 'muted' }, `Jolpica 피트레인 통과 시간 기준(타이어 교체 정지 시간이 아님). 90초 초과·레이스 중앙값의 1.5배 초과 ${c.excluded}건(적색기·페널티 등)은 통계에서 뺐습니다.`),
    h('div', { class: 'cards' },
      stat('총 피트스톱', String(c.total), `${c.races}개 레이스`),
      stat('평균 통과 시간', sec(c.avgLaneMs), '이상치 제외'),
      stat('중앙값', sec(c.medianLaneMs)),
      stat('최단 통과 시간', c.fastest ? sec(c.fastest.laneMs) : '–', c.fastest && `${c.fastest.code ?? c.fastest.driverName} · R${c.fastest.round}`),
      stat('레이스당 평균', c.perRace.toFixed(1), '회'),
      stat('가장 빠른 팀', c.bestTeam?.name ?? '–', c.bestTeam && `중앙값 대비 ${signed(c.bestTeam.avgDelta, 2)}`)),
    block('최단 피트스톱 Top 20', topTable, '통과 시간'),
    block('팀별 일관성', boxPlot({ groups: d.teams.map((t) => ({ label: t.name, color: color(t), values: t.deltas })), format: (v) => signed(v), title: '팀별 피트스톱 일관성 박스플롯' }), '레이스 중앙값 대비 · 왼쪽일수록 빠름'),
    block('그랑프리별 평균', lineChart({ series: [{ id: 'all', label: '전체 평균', color: 'var(--text)', dashed: true, values: d.rounds.map((r) => r.avgLaneMs) }, ...teamSeries], xLabels: d.rounds.map((r) => `R${r.round}`), visible: ['all'], format: sec, title: '그랑프리별 평균 통과 시간 선 차트', auto: true, asc: true, left: 60 }), '범례에서 팀을 켜서 비교합니다 · 서킷마다 피트레인 길이가 달라 값이 다릅니다'),
    block('컨스트럭터별 평균', barChart({ items: bars(d.teams, (x) => x.name), format: plus, title: '컨스트럭터별 평균 피트스톱' }), '가장 빠른 팀 대비 · 레이스 중앙값 기준'),
    block('드라이버별 평균', barChart({ items: bars(d.drivers, (x) => x.code ?? x.name), format: plus, title: '드라이버별 평균 피트스톱' }), '가장 빠른 드라이버 대비 · 5회 이상'),
    stopTable ? block('정지 시간 (수집 3개 레이스)', stopTable, `OpenF1 정지 시간 · ${d.stopRaces.join(', ')}`) : null,
  ];
}

async function init() {
  mount(body, skeleton());
  try {
    const { races } = await api('/races', { season: urlParam('season') });
    const finished = tab === 'stint' ? races.filter((r) => r.collected) : races.filter((r) => r.finished);
    if (!finished.length) return mount(body, emptyState(tab === 'stint' ? '스틴트 데이터가 수집된 레이스가 없습니다.' : '결과가 있는 레이스가 없습니다.'));
    const race = finished.find((r) => r.id === Number(urlParam('race'))) ?? finished.at(-1);
    mount(nav, raceTabs(tab, race));
    if (tab === 'pit') { // 시즌 단위 화면이라 레이스 선택기는 없고, 탭 이동용으로만 레이스를 유지한다.
      mount(head, h('div', null, h('h1', null, '피트스톱 통계'), h('div', { class: 'sub' }, `${race.season} 시즌 전체`)));
      return load(body, () => api('/pitstops', { season: urlParam('season') }), pitView);
    }
    const clean = urlParam('clean') !== 'false';
    const cutoff = Number(urlParam('cutoff')) || 107;

    const select = h('select', { 'aria-label': '레이스 선택' }, finished.map((r) => h('option', { value: r.id, selected: r.id === race.id }, `R${r.round} ${r.name}`)));
    select.addEventListener('change', () => setUrlParams({ race: select.value }));
    mount(head, h('div', null, h('h1', null, `${race.name} ${tab === 'stint' ? '스틴트·스피드트랩' : '레이스 페이스'}`), h('div', { class: 'sub' }, `${race.circuit_name ?? ''} · ${race.season} 시즌 ${race.round}라운드`)), select);

    if (tab === 'stint') return load(body, () => api(`/races/${race.id}/strategy`), stintView);

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
