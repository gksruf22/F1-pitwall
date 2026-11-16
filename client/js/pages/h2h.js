// 드라이버 비교(헤드투헤드): 프리셋(팀메이트) 또는 직접 선택한 두 명의 예선·결승·스프린트 승수 비교.
import { h, mount } from '../dom.js';
import { api, urlParam, setUrlParams } from '../api.js';
import { mountLayout, analysisTabs } from '../layout.js';
import { load, table, emptyState, errorState, skeleton } from '../ui.js';
import { teamColor } from '../teams.js';

mountLayout('analysis');
const season = urlParam('season');
const a = urlParam('a'), b = urlParam('b');
const body = h('div', { class: 'stack' });
document.getElementById('app').append(h('div', { class: 'page-head' }, h('div', null, h('h1', null, '드라이버 비교'), h('div', { class: 'sub' }, '같은 라운드에 둘 다 기록이 있는 경기만 비교 · DNF는 완주한 쪽이 승리'))), analysisTabs('h2h'), body);

const go = (x, y) => setUrlParams({ a: x, b: y });

function picker(drivers) {
  const opts = (sel) => drivers.map((d) => h('option', { value: d.id, selected: d.id === sel }, `${d.name} (${d.code ?? ''})`));
  const sa = h('select', { 'aria-label': '드라이버 A' }, opts(a)), sb = h('select', { 'aria-label': '드라이버 B' }, opts(b));
  return h('div', { class: 'tools', style: 'flex-wrap:wrap' }, sa, h('span', { class: 'muted' }, 'vs'), sb,
    h('button', { class: 'btn primary', onclick: () => (sa.value === sb.value ? alertSame() : go(sa.value, sb.value)) }, '비교'));
}
const alertSame = () => mount(result, errorState('서로 다른 드라이버 2명을 선택하세요.'));
const result = h('div', { class: 'stack' });

// 두 사람의 승수를 한 줄 막대로 나눠 보여준다.
function duelCard(title, r, A, B) {
  const total = r.a + r.b;
  return h('div', { class: 'card' }, h('div', { class: 'label' }, title),
    h('div', { class: 'duel' }, h('div', { class: 'side num' }, r.a), h('div', { class: 'vs' }, 'WINS'), h('div', { class: 'side r num' }, r.b)),
    h('div', { class: 'split' }, total ? [
      h('i', { style: `width:${(r.a / total) * 100}%;background:${teamColor(A.teamId, A.color)}` }),
      h('i', { style: `width:${(r.b / total) * 100}%;background:${teamColor(B.teamId, B.color)};opacity:${A.teamId === B.teamId ? 0.55 : 1}` })] : null),
    h('div', { class: 'muted', style: 'margin-top:8px' }, total ? `비교 ${r.rounds.length}경기` : '비교할 경기가 없습니다.'));
}

async function show() {
  mount(body, skeleton(3, 80));
  const [{ drivers }, { presets }] = await Promise.all([api('/drivers', { season }), api('/analysis/h2h/presets', { season })]);
  const presetCards = h('div', { class: 'cards' }, presets.map((p) =>
    h('a', { class: 'pcard', href: `?${new URLSearchParams({ ...(season ? { season } : {}), a: p.a.id, b: p.b.id })}`, style: `--c:${teamColor(p.teamId, p.color)}` },
      h('div', { class: 'nm' }, `${p.a.code} vs ${p.b.code}`), h('div', { class: 'muted' }, `${p.teamName} 팀메이트`))));
  mount(body, h('section', null, h('div', { class: 'section-title' }, h('h2', null, '팀메이트 비교')), presetCards),
    h('section', null, h('div', { class: 'section-title' }, h('h2', null, '직접 선택')), picker(drivers)), result);
  if (a && b) await load(result, () => api('/analysis/h2h', { season, a, b }), (d) => [
    h('h2', null, `${d.a.name} vs ${d.b.name}`),
    h('div', { class: 'grid cols-3' }, duelCard('예선', d.qualifying, d.a, d.b), duelCard('결승', d.race, d.a, d.b), duelCard('스프린트', d.sprint, d.a, d.b)),
    h('section', null, h('div', { class: 'section-title' }, h('h2', null, '라운드별 결승')),
      d.race.rounds.length ? table([
        { label: 'R', render: (r) => r.round }, { label: '그랑프리', render: (r) => r.raceName },
        { label: d.a.code, align: 'right', render: (r) => h('span', { class: r.winner === 'a' ? 'up' : '' }, r.aDnf ? 'DNF' : `${r.a}위`) },
        { label: d.b.code, align: 'right', render: (r) => h('span', { class: r.winner === 'b' ? 'up' : '' }, r.bDnf ? 'DNF' : `${r.b}위`) },
      ], d.race.rounds) : emptyState('같은 레이스에 모두 출전한 기록이 없습니다.')),
  ]);
}
show().catch((e) => mount(body, errorState(e.message, show)));
