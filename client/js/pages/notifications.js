// 알림 목록. 클릭하면 읽음 처리, "모두 읽음"으로 한 번에 처리한다.
import { h } from '../dom.js';
import { mountLayout } from '../layout.js';
import { load, emptyState } from '../ui.js';
import { getAuth, send } from '../auth.js';
import { kstDate, kstTime } from '../format.js';

mountLayout('');
if (!getAuth()) location.replace('/login.html?next=/notifications.html');
const body = h('div', { class: 'stack' });
const all = h('button', { class: 'btn', type: 'button' }, '모두 읽음');
document.getElementById('app').append(
  h('div', { class: 'page-head' }, h('div', null, h('h1', null, '알림'), h('div', { class: 'sub' }, '즐겨찾기 결과·Fantasy 채점·다음 그랑프리 알림 (30초마다 새로 확인)')), all), body);

const LABEL = { FAV_RESULT: '결과', FAV_POLE: '폴', RACE_SOON: '일정', FANTASY_SCORED: 'Fantasy', POST_COMMENT: '댓글' };

function render() {
  load(body, () => send('GET', '/notifications'), ({ notifications }) => {
    all.hidden = !notifications.some((n) => !n.read);
    if (!notifications.length) return emptyState('아직 알림이 없습니다. 드라이버·팀을 즐겨찾기하거나 Fantasy 예측을 해 보세요.');
    return h('ul', { class: 'feed notes' }, notifications.map((n) => {
      const li = h('li', { class: n.read ? 'read' : 'unread', tabindex: 0 },
        h('span', { class: 'pill' }, LABEL[n.kind] ?? '알림'), ' ', n.text,
        h('span', { class: 'muted num' }, `  ${kstDate(n.createdUtc)} ${kstTime(n.createdUtc)}`));
      const mark = async () => { if (n.read) return; await send('POST', `/notifications/${n.id}/read`).catch(() => {}); n.read = true; li.className = 'read'; };
      li.addEventListener('click', mark);
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter') mark(); });
      return li;
    }));
  });
}
all.addEventListener('click', async () => { await send('POST', '/notifications/read-all'); render(); });
render();
setInterval(render, 30_000);
