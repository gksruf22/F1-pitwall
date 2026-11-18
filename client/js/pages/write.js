// 글쓰기·수정(?id=). 제목 100자, 본문 5000자, 텍스트만.
import { h, mount } from '../dom.js';
import { urlParam } from '../api.js';
import { mountLayout } from '../layout.js';
import { load } from '../ui.js';
import { getAuth, send } from '../auth.js';

mountLayout('board');
const id = urlParam('id');
const app = document.getElementById('app');
if (!getAuth()) location.replace(`/login.html?next=${encodeURIComponent(location.pathname + location.search)}`);

function form(post) {
  const title = h('input', { type: 'text', required: true, maxlength: 100, value: post?.title ?? '' });
  const body = h('textarea', { required: true, maxlength: 5000, rows: 14 });
  body.value = post?.body ?? '';
  const msg = h('p', { class: 'form-msg', role: 'alert' });
  const submit = h('button', { class: 'btn primary', type: 'submit' }, id ? '수정 완료' : '등록');
  const el = h('form', { class: 'card form' },
    h('label', { class: 'field' }, h('span', null, '제목'), title, h('small', { class: 'muted' }, '최대 100자')),
    h('label', { class: 'field' }, h('span', null, '본문'), body, h('small', { class: 'muted' }, '최대 5000자, 텍스트만')),
    msg, h('div', { class: 'actions' }, submit, h('a', { class: 'btn', href: id ? `/post.html?id=${id}` : '/board.html' }, '취소')));
  el.addEventListener('submit', async (e) => {
    e.preventDefault(); submit.disabled = true; msg.textContent = '';
    try {
      const data = { title: title.value, body: body.value };
      const res = id ? await send('PUT', `/posts/${id}`, data) : await send('POST', '/posts', data);
      location.href = `/post.html?id=${id ?? res.id}`;
    } catch (err) { msg.textContent = err.message; submit.disabled = false; }
  });
  return el;
}

const head = h('div', { class: 'page-head' }, h('h1', null, id ? '글 수정' : '글쓰기'));
const box = h('div');
mount(app, head, box);
if (id) load(box, () => send('GET', `/posts/${id}`), ({ post }) => form(post));
else box.append(form());
