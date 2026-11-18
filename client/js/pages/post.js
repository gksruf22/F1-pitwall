// 게시글 상세 + 댓글. 수정·삭제 버튼은 작성자 본인에게만 보인다(서버에서도 다시 검사).
import { h } from '../dom.js';
import { urlParam } from '../api.js';
import { mountLayout } from '../layout.js';
import { load, emptyState } from '../ui.js';
import { getAuth, send } from '../auth.js';
import { kstDate, kstTime } from '../format.js';

mountLayout('board');
const id = urlParam('id');
const app = document.getElementById('app');
const me = getAuth()?.user.id;
const when = (utc) => `${kstDate(utc)} ${kstTime(utc)}`;

async function remove(path, done) {
  if (!confirm('삭제할까요?')) return;
  try { await send('DELETE', path); done(); } catch (e) { alert(e.message); }
}

function commentForm() {
  if (!me) return h('p', { class: 'muted' }, h('a', { href: `/login.html?next=${encodeURIComponent(location.pathname + location.search)}` }, '로그인'), '하면 댓글을 남길 수 있습니다.');
  const input = h('textarea', { required: true, maxlength: 1000, rows: 3, 'aria-label': '댓글' });
  const msg = h('p', { class: 'form-msg', role: 'alert' });
  const submit = h('button', { class: 'btn primary', type: 'submit' }, '댓글 등록');
  const form = h('form', { class: 'form' }, h('label', { class: 'field' }, h('span', null, '댓글 쓰기'), input), msg, submit);
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); submit.disabled = true; msg.textContent = '';
    try { await send('POST', `/posts/${id}/comments`, { body: input.value }); render(); } catch (err) { msg.textContent = err.message; submit.disabled = false; }
  });
  return form;
}

function render() {
  load(app, () => send('GET', `/posts/${id}`), ({ post, comments }) => {
    document.title = `${post.title} · F1 PITWALL`;
    const mine = post.userId === me;
    return [
      h('div', { class: 'page-head' }, h('div', null, h('h1', null, post.title),
        h('div', { class: 'sub' }, `${post.nickname} · ${when(post.createdUtc)}${post.updatedUtc ? ' (수정됨)' : ''}`)),
        h('div', { class: 'actions' }, h('a', { class: 'btn', href: '/board.html' }, '목록'),
          mine && h('a', { class: 'btn', href: `/write.html?id=${post.id}` }, '수정'),
          mine && h('button', { class: 'btn', type: 'button', onclick: () => remove(`/posts/${post.id}`, () => location.replace('/board.html')) }, '삭제'))),
      h('article', { class: 'card post-body' }, post.body),
      h('section', { class: 'stack' }, h('div', { class: 'section-title' }, h('h2', null, `댓글 ${comments.length}`)),
        comments.length ? h('ul', { class: 'feed comments' }, comments.map((c) => h('li', null,
          h('div', { class: 'muted' }, `${c.nickname} · ${when(c.createdUtc)}`,
            c.userId === me && h('button', { class: 'link', type: 'button', onclick: () => remove(`/posts/${post.id}/comments/${c.id}`, render) }, '삭제')),
          h('p', { class: 'post-body' }, c.body)))) : emptyState('아직 댓글이 없습니다.'),
        commentForm()),
    ];
  });
}
if (!id) app.append(emptyState('글 번호가 없습니다.')); else render();
