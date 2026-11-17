// 내 즐겨찾기 목록(드라이버·팀). 로그인이 필요하다.
import { h } from '../dom.js';
import { mountLayout } from '../layout.js';
import { load, emptyState, colorBar } from '../ui.js';
import { getAuth, send } from '../auth.js';
import { teamColor } from '../teams.js';

mountLayout('');
const app = document.getElementById('app');
if (!getAuth()) location.replace('/login.html?next=/favorites.html');

const body = h('div', { class: 'stack' });
app.append(h('div', { class: 'page-head' }, h('div', null, h('h1', null, '즐겨찾기'), h('div', { class: 'sub' }, '드라이버·팀 상세 화면의 ★ 버튼으로 추가합니다'))), body);

const list = (title, items, href) => h('section', null, h('div', { class: 'section-title' }, h('h2', null, title)),
  h('ul', { class: 'feed' }, items.map((f) => h('li', null, colorBar(teamColor(f.kind === 'team' ? f.id : null, f.color)), ' ',
    h('a', { href: `${href}?id=${encodeURIComponent(f.id)}` }, f.name), f.code && h('span', { class: 'muted' }, ` ${f.code}`)))));

load(body, () => send('GET', '/favorites'), ({ favorites }) => {
  if (!favorites.length) return emptyState('아직 즐겨찾기가 없습니다. 드라이버나 팀 상세 화면에서 ★를 눌러 추가해 보세요.');
  const of = (k) => favorites.filter((f) => f.kind === k);
  return [of('driver').length && list('드라이버', of('driver'), '/driver.html'), of('team').length && list('팀', of('team'), '/team.html')];
});
