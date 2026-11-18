// 통합 검색 결과: 유형별(뉴스·드라이버·팀·서킷·레이스·게시글) 그룹.
import { h } from '../dom.js';
import { api, urlParam } from '../api.js';
import { mountLayout } from '../layout.js';
import { load, emptyState } from '../ui.js';
import { kstDate } from '../format.js';

mountLayout('');
const q = (urlParam('q') ?? '').trim();
const body = h('div', { class: 'stack' });
document.getElementById('app').append(h('div', { class: 'page-head' }, h('h1', null, q ? `"${q}" 검색 결과` : '검색')), body);

const group = (title, items, row) => items.length ? h('section', null, h('div', { class: 'section-title' }, h('h2', null, `${title} ${items.length}`)), h('ul', { class: 'feed' }, items.map(row))) : null;
const link = (href, text, extra) => h('li', null, h('a', { href }, text), extra && h('span', { class: 'muted' }, extra));

if (q.length < 2) body.append(emptyState('검색어를 2글자 이상 입력하세요.'));
else load(body, () => api('/search', { q }), (d) => {
  const groups = [
    group('드라이버', d.drivers, (x) => link(`/driver.html?id=${encodeURIComponent(x.id)}`, `${x.name}${x.code ? ` (${x.code})` : ''}`, x.teamName)),
    group('팀', d.teams, (x) => link(`/team.html?id=${encodeURIComponent(x.id)}`, x.name)),
    group('서킷', d.circuits, (x) => link(`/circuit.html?id=${encodeURIComponent(x.id)}`, x.name, x.country)),
    group('레이스', d.races, (x) => link(`/results.html?race=${x.id}&season=${x.season}`, x.name, `${x.season} · R${x.round}`)),
    group('뉴스', d.news, (n) => h('li', null, h('span', { class: 'chip' }, n.source), h('a', { href: n.url, target: '_blank', rel: 'noopener noreferrer' }, n.title), n.publishedUtc && h('span', { class: 'muted', style: 'margin-left:auto' }, kstDate(n.publishedUtc)))),
    group('게시글', d.posts, (x) => link(`/post.html?id=${x.id}`, x.title, kstDate(x.createdUtc))),
  ].filter(Boolean);
  return groups.length ? groups : emptyState('검색 결과가 없습니다.');
});
