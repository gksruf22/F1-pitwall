// 언더컷/오버컷: 피트스톱 순서가 순위 변화를 만든 경우를 시즌 단위로 집계한다(랩·피트 데이터에서 계산).
import { h } from '../dom.js';
import { api, urlParam } from '../api.js';
import { mountLayout, analysisTabs } from '../layout.js';
import { load, table, colorBar, emptyState } from '../ui.js';
import { barChart } from '../charts/bar.js';
import { teamColor } from '../teams.js';

mountLayout('analysis');
const body = h('div', { class: 'stack' });
document.getElementById('app').append(
  h('div', { class: 'page-head' }, h('div', null, h('h1', null, '언더컷/오버컷'),
    h('div', { class: 'sub' }, '바로 앞·뒤 차(3초 이내)와 5랩 안에 이어 정지한 경우만 비교 · 두 차의 정지가 끝난 뒤 순서로 판정'))),
  analysisTabs('undercut'), body);

const pct = (ok, n) => (n ? `${Math.round((ok / n) * 100)}%` : '–');
const stat = (label, value, note) => h('div', { class: 'card' }, h('div', { class: 'label' }, label), h('div', { class: 'big num' }, value), note && h('div', { class: 'muted' }, note));
const TYPE = { UNDERCUT: ['언더컷 성공', 'up'], UNDERCUT_FAILED: ['언더컷 실패', 'down'], OVERCUT: ['오버컷 성공', 'up'], DEFENDED: ['방어 성공', 'muted'] };
const block = (title, node, note) => h('section', null, h('div', { class: 'section-title' }, h('h2', null, title), note && h('span', { class: 'muted' }, note)), node);

load(body, () => api('/undercut', { season: urlParam('season') }), (d) => {
  const t = d.totals;
  if (!t.undercut && !t.overcut) return emptyState('이 시즌은 랩·피트스톱 데이터가 없어 계산할 수 없습니다.');
  const rated = d.teams.filter((x) => x.undercut >= 3);
  return [
    h('div', { class: 'cards' },
      stat('언더컷 시도', String(t.undercut), '뒤차가 먼저 정지'),
      stat('언더컷 성공률', pct(t.undercutOk, t.undercut), `${t.undercutOk}건 성공`),
      stat('오버컷 시도', String(t.overcut), '앞차가 먼저 정지, 뒤차는 버팀'),
      stat('오버컷 성공률', pct(t.overcutOk, t.overcut), `${t.overcutOk}건 성공 · 나머지는 앞차 방어`)),
    block('팀별 언더컷 성공률', rated.length ? barChart({
      items: [...rated].sort((a, b) => b.undercutOk / b.undercut - a.undercutOk / a.undercut)
        .map((x) => ({ label: `${x.name} (${x.undercutOk}/${x.undercut})`, value: Math.round((x.undercutOk / x.undercut) * 100), color: teamColor(x.id, x.color) })),
      format: (v) => `${v}%`, left: 200, title: '팀별 언더컷 성공률',
    }) : emptyState('시도 3건 이상인 팀이 없습니다.'), '시도 3건 이상인 팀만'),
    block('팀별 집계', table([
      { label: '팀', render: (x) => h('div', { class: 'who' }, colorBar(teamColor(x.id, x.color)), h('b', null, x.name)) },
      { label: '언더컷', align: 'right', render: (x) => `${x.undercutOk} / ${x.undercut}` },
      { label: '성공률', align: 'right', render: (x) => pct(x.undercutOk, x.undercut) },
      { label: '오버컷', align: 'right', render: (x) => `${x.overcutOk} / ${x.overcut}` },
      { label: '성공률', align: 'right', render: (x) => pct(x.overcutOk, x.overcut) },
    ], d.teams)),
    block('최근 사례', table([
      { label: '레이스', render: (e) => `R${e.round} ${e.raceName}`, class: 'muted' },
      { label: '랩', align: 'right', render: (e) => e.lap },
      { label: '먼저 정지', render: (e) => h('div', { class: 'who' }, colorBar(teamColor(e.first.teamId, e.first.color)), h('b', null, e.first.code)) },
      { label: '상대', render: (e) => h('div', { class: 'who' }, colorBar(teamColor(e.second.teamId, e.second.color)), h('b', null, e.second.code)) },
      { label: '간격', align: 'right', render: (e) => `${(e.gapMs / 1000).toFixed(1)}초`, class: 'muted' },
      { label: '결과', render: (e) => h('span', { class: TYPE[e.type][1] }, TYPE[e.type][0]) },
    ], d.events.slice(0, 30)), '최근 라운드 순 30건'),
    h('p', { class: 'muted' }, '한계: 세이프티카·적기 중 정지(무료 정지)와 앞뒤 차의 다른 변수는 가려내지 않습니다. 같은 랩 정지는 제외합니다.'),
  ];
});
