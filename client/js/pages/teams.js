// 팀 목록: 컨스트럭터 순위 순 카드 그리드.
import { h } from '../dom.js';
import { api, urlParam } from '../api.js';
import { mountLayout, profileTabs } from '../layout.js';
import { load, emptyState, skeleton } from '../ui.js';
import { teamColor } from '../teams.js';
import { points } from '../format.js';

mountLayout('profiles');
const body = h('div');
document.getElementById('app').append(h('div', { class: 'page-head' }, h('h1', null, '팀')), profileTabs('teams'), body);

load(body, () => api('/teams', { season: urlParam('season') }), ({ season, teams }) =>
  teams.length ? h('div', { class: 'cards' }, teams.map((t) =>
    h('a', { class: 'pcard', href: `/team.html?id=${encodeURIComponent(t.id)}&season=${season}`, style: `--c:${teamColor(t.id, t.color)}` },
      h('div', { class: 'no num' }, t.position ?? '–'),
      h('div', { class: 'nm' }, t.name),
      h('div', { class: 'muted' }, t.drivers.map((d) => d.name).join(' · ')),
      h('div', { class: 'meta' }, h('span', { class: 'chip' }, '컨스트럭터 순위'), h('b', { class: 'num' }, `${points(t.points)} pts`)))))
    : emptyState('이 시즌의 팀 정보가 없습니다.'), skeleton(4, 120));
