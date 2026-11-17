// ★ 즐겨찾기 토글(드라이버·팀 상세 공통). 비로그인이면 로그인 화면으로 보낸다.
import { h } from './dom.js';
import { getAuth, send } from './auth.js';

export function favoriteButton(kind, id) {
  const btn = h('button', { class: 'btn fav', type: 'button', 'aria-pressed': 'false' }, '☆ 즐겨찾기');
  const paint = (on) => { btn.textContent = on ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기'; btn.setAttribute('aria-pressed', String(on)); };
  let on = false;
  if (getAuth()) {
    send('GET', '/favorites').then((d) => { on = d.favorites.some((f) => f.kind === kind && f.id === id); paint(on); }).catch(() => {});
  }
  btn.addEventListener('click', async () => {
    if (!getAuth()) { location.href = `/login.html?next=${encodeURIComponent(location.pathname + location.search)}`; return; }
    btn.disabled = true;
    try {
      await send(on ? 'DELETE' : 'PUT', `/favorites/${kind}/${encodeURIComponent(id)}`);
      on = !on; paint(on);
    } catch (err) {
      btn.textContent = err.message;
    } finally { btn.disabled = false; }
  });
  return btn;
}
