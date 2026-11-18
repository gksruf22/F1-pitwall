// 게시판 목록(20개씩 페이지). 읽기는 누구나, 글쓰기는 로그인 필요.
import { h } from '../dom.js';
import { api, urlParam, setUrlParams } from '../api.js';
import { mountLayout } from '../layout.js';
import { load, emptyState } from '../ui.js';
import { getAuth } from '../auth.js';
import { kstDate } from '../format.js';

mountLayout('board');
const page = Number(urlParam('page')) || 1;
const body = h('div', { class: 'stack' });
const write = h('a', { class: 'btn primary', href: getAuth() ? '/write.html' : '/login.html?next=/write.html' }, '글쓰기');
document.getElementById('app').append(
  h('div', { class: 'page-head' }, h('div', null, h('h1', null, '게시판'), h('div', { class: 'sub' }, '레이스 이야기를 자유롭게 나눠 보세요 (텍스트만)')), write), body);

load(body, () => api('/posts', { page }), (d) => {
  if (!d.posts.length) return emptyState(page > 1 ? '이 페이지에는 글이 없습니다.' : '아직 글이 없습니다. 첫 글을 남겨 보세요.');
  const btn = (p, label) => h('button', { class: 'btn', type: 'button', disabled: p < 1 || p > d.pages, onclick: () => setUrlParams({ page: p }) }, label);
  return [
    h('ul', { class: 'feed' }, d.posts.map((p) => h('li', null,
      h('a', { href: `/post.html?id=${p.id}` }, p.title), p.comments > 0 && h('span', { class: 'chip' }, `댓글 ${p.comments}`),
      h('span', { class: 'muted', style: 'margin-left:auto' }, `${p.nickname} · ${kstDate(p.createdUtc)}`)))),
    d.pages > 1 && h('div', { class: 'pager' }, btn(page - 1, '이전'), h('span', { class: 'muted num' }, `${page} / ${d.pages}`), btn(page + 1, '다음')),
  ];
});
