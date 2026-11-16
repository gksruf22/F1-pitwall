// 드라이버 목록: 시즌 순위 순 카드 그리드 (팀 컬러).
import { h } from '../dom.js';
import { api, urlParam } from '../api.js';
import { mountLayout, profileTabs } from '../layout.js';
import { load, emptyState, skeleton } from '../ui.js';
import { teamColor } from '../teams.js';
import { points } from '../format.js';

mountLayout('profiles');
const body = h('div');
document.getElementById('app').append(h('div', { class: 'page-head' }, h('h1', null, '드라이버')), profileTabs('drivers'), body);

const season = urlParam('season');
load(body, () => api('/drivers', { season }), ({ season: y, drivers }) =>
  drivers.length ? h('div', { class: 'cards' }, drivers.map((d) =>
    h('a', { class: 'pcard', href: `/driver.html?id=${encodeURIComponent(d.id)}&season=${y}`, style: `--c:${teamColor(d.teamId, d.color)}` },
      h('div', { class: 'no num' }, d.number ?? '–'),
      h('div', { class: 'nm' }, d.name),
      h('div', { class: 'muted' }, `${d.teamName} · ${d.nationality ?? ''}`),
      h('div', { class: 'meta' }, h('span', { class: 'chip' }, d.position ? `${d.position}위` : '순위 없음'), h('b', { class: 'num' }, `${points(d.points)} pts`)))))
    : emptyState('이 시즌의 드라이버 정보가 없습니다.'), skeleton(4, 120));
