// 서킷 목록: 나라·이름 순 카드 그리드. (트랙 맵 SVG는 위치 데이터가 생기는 3등급에서 추가)
import { h } from '../dom.js';
import { api } from '../api.js';
import { mountLayout, profileTabs } from '../layout.js';
import { load, emptyState, skeleton } from '../ui.js';

mountLayout('profiles');
const body = h('div');
document.getElementById('app').append(h('div', { class: 'page-head' }, h('h1', null, '서킷')), profileTabs('circuits'), body);

load(body, () => api('/circuits'), ({ circuits }) =>
  circuits.length ? h('div', { class: 'cards' }, circuits.map((c) =>
    h('a', { class: 'pcard', href: `/circuit.html?id=${encodeURIComponent(c.id)}` },
      h('div', { class: 'nm' }, c.name),
      h('div', { class: 'muted' }, c.country ?? ''),
      h('div', { class: 'meta' }, h('span', { class: 'chip' }, `수집한 레이스 ${c.races}회`), h('span', { class: 'muted num' }, c.lastSeason ?? '')))))
    : emptyState('서킷 정보가 없습니다.'), skeleton(4, 100));
