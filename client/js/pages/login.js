// 로그인·가입 화면. 성공하면 토큰을 저장하고 돌아갈 곳(?next=, 같은 사이트 경로만)으로 이동한다.
import { h, mount } from '../dom.js';
import { mountLayout } from '../layout.js';
import { tabs } from '../ui.js';
import { send, setAuth, getAuth } from '../auth.js';
import { urlParam } from '../api.js';

mountLayout('');
const app = document.getElementById('app');
let mode = 'login';

const next = () => { const n = urlParam('next'); return n && /^\/[^/\\]/.test(n) ? n : '/'; };

function view() {
  const email = h('input', { type: 'email', required: true, autocomplete: 'email', maxlength: 100 });
  const nick = h('input', { type: 'text', required: true, minlength: 2, maxlength: 20, autocomplete: 'nickname' });
  const pw = h('input', { type: 'password', required: true, minlength: mode === 'register' ? 8 : 1, maxlength: 72, autocomplete: mode === 'register' ? 'new-password' : 'current-password' });
  const msg = h('p', { class: 'form-msg', role: 'alert' });
  const submit = h('button', { class: 'btn primary', type: 'submit' }, mode === 'login' ? '로그인' : '가입하기');
  const field = (label, input, note) => h('label', { class: 'field' }, h('span', null, label), input, note && h('small', { class: 'muted' }, note));
  const form = h('form', { class: 'card form' },
    field('이메일', email),
    mode === 'register' && field('닉네임', nick, '2~20자'),
    field('비밀번호', pw, mode === 'register' ? '8자 이상' : null),
    msg, submit);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submit.disabled = true; msg.textContent = '';
    try {
      const body = mode === 'login' ? { email: email.value, password: pw.value } : { email: email.value, nickname: nick.value, password: pw.value };
      setAuth(await send('POST', `/auth/${mode}`, body));
      location.href = next();
    } catch (err) {
      msg.textContent = err.message; submit.disabled = false;
    }
  });
  return form;
}

function render() {
  if (getAuth()) { location.replace(next()); return; }
  mount(app,
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, mode === 'login' ? '로그인' : '가입'),
      h('div', { class: 'sub' }, '즐겨찾기·Fantasy·게시판 등 참여 기능에 필요합니다'))),
    h('div', { class: 'auth-box stack' }, tabs([{ key: 'login', label: '로그인' }, { key: 'register', label: '가입' }], mode, (k) => { mode = k; render(); }), view()));
}
render();
