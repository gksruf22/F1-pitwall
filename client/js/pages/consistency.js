// 일관성: 드라이버별 순위 분포 박스플롯(결승·스프린트·예선) + 컷오프 점선. DNF 제외 토글.
import { h } from '../dom.js';
import { api, urlParam, setUrlParams } from '../api.js';
import { mountLayout, analysisTabs } from '../layout.js';
import { load, emptyState } from '../ui.js';
import { boxPlot } from '../charts/box.js';
import { teamColor } from '../teams.js';

mountLayout('analysis');
const excludeDnf = urlParam('excludeDnf') === 'true';
const body = h('div', { class: 'stack' });
const toggle = h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: excludeDnf, onchange: (e) => setUrlParams({ excludeDnf: e.target.checked ? 'true' : null }) }), 'DNF 제외');
document.getElementById('app').append(h('div', { class: 'page-head' }, h('div', null, h('h1', null, '일관성'), h('div', { class: 'sub' }, '드라이버별 순위 분포 — 상자가 좁고 왼쪽일수록 꾸준히 앞순위')), toggle), analysisTabs('consistency'), body);

const plot = (list, cutoffs, title) => list.length
  ? boxPlot({ groups: list.map((e) => ({ label: e.code ?? e.name, color: teamColor(e.teamId, e.color), values: e.positions })), markers: cutoffs, format: (v) => (v >= 1 ? `${Math.round(v)}위` : ''), title })
  : emptyState('데이터가 없습니다.');
const block = (title, node, note) => h('section', null, h('div', { class: 'section-title' }, h('h2', null, title), note && h('span', { class: 'muted' }, note)), node);

load(body, () => api('/analysis/consistency', { season: urlParam('season'), excludeDnf }), (d) => [
  block('결승 순위', plot(d.race, d.cutoffs.race, '결승 순위 분포'), excludeDnf ? 'DNF 제외' : 'DNF 포함(최종 순위 기준)'),
  d.sprint.length ? block('스프린트 순위', plot(d.sprint, d.cutoffs.sprint, '스프린트 순위 분포')) : null,
  block('예선 순위', plot(d.qualifying, d.cutoffs.qualifying, '예선 순위 분포')),
  block('스프린트 예선 순위', emptyState('스프린트 예선 결과는 Jolpica에 없어 OpenF1 수집 후 제공합니다.')),
]);
