// 서킷 상세: 기본 정보 + 이 서킷에서 열린 레이스 목록(우승자). 길이·턴 수는 직접 정리 전이라 값이 있을 때만 표시.
import { h } from '../dom.js';
import { api, urlParam } from '../api.js';
import { mountLayout, profileTabs } from '../layout.js';
import { load, table, emptyState } from '../ui.js';
import { kstDate } from '../format.js';

mountLayout('profiles');
const body = h('div', { class: 'stack' });
document.getElementById('app').append(profileTabs('circuits'), body);

load(body, () => api(`/circuits/${encodeURIComponent(urlParam('id') ?? '')}`), ({ circuit: c, races }) => [
  h('div', { class: 'head-bar' }, h('h1', null, c.name),
    h('div', { class: 'facts' },
      c.country && h('span', { class: 'chip' }, c.country),
      c.lengthKm && h('span', { class: 'chip' }, `${c.lengthKm} km`),
      c.turns && h('span', { class: 'chip' }, `${c.turns}개 코너`),
      c.lat != null && h('span', { class: 'chip' }, `${c.lat.toFixed(3)}, ${c.lon.toFixed(3)}`))),
  h('section', null, h('div', { class: 'section-title' }, h('h2', null, '개최한 레이스')),
    races.length ? table([
      { label: '시즌', render: (r) => r.season },
      { label: '그랑프리', render: (r) => h('a', { href: `/results.html?race=${r.id}&season=${r.season}` }, r.name) },
      { label: '날짜(KST)', render: (r) => (r.startUtc ? kstDate(r.startUtc) : '–') },
      { label: '우승', render: (r) => (r.winner ? `${r.winner.name} (${r.winner.teamName ?? ''})` : h('span', { class: 'muted' }, '개최 전')) },
    ], races) : emptyState('수집한 레이스가 없습니다.')),
]);
