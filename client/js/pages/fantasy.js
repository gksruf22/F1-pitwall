// Fantasy 포디움 예측: 마감 전 레이스에 1~3위를 예측하고, 채점 결과와 시즌 랭킹을 본다.
import { h, mount } from '../dom.js';
import { api, urlParam } from '../api.js';
import { mountLayout } from '../layout.js';
import { load, table, emptyState, skeleton } from '../ui.js';
import { getAuth, send } from '../auth.js';
import { kstDate, kstTime } from '../format.js';

mountLayout('fantasy');
const app = document.getElementById('app');
const formBox = h('div', { class: 'stack' }), mineBox = h('div', { class: 'stack' }), rankBox = h('div', { class: 'stack' });
const block = (title, node, note) => h('section', null, h('div', { class: 'section-title' }, h('h2', null, title), note && h('span', { class: 'muted' }, note)), node);
app.append(
  h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Fantasy 예측'),
    h('div', { class: 'sub' }, '예선 시작 전까지 1~3위를 예측하세요. 자리 적중 +3점, 포디움 다른 자리 +1점, 3명 모두 적중하면 보너스 +3점(최대 12점)'))),
  h('div', { class: 'stack' }, formBox, block('내 예측', mineBox), block('시즌 랭킹', rankBox, '동점이면 자리 적중 수가 많은 순')));

const season = urlParam('season');

async function renderForm() {
  mount(formBox, skeleton(2, 40));
  try {
    const { races } = await api('/fantasy/races', { season });
    const open = races.filter((r) => r.open);
    if (!open.length) return mount(formBox, emptyState('지금 예측할 수 있는 레이스가 없습니다.'));
    const pick = h('select', { 'aria-label': '레이스 선택' }, open.map((r) => h('option', { value: r.id }, `R${r.round} ${r.name}`)));
    const slot = h('div', { class: 'stack' });
    const draw = async () => {
      const race = open.find((r) => r.id === Number(pick.value));
      mount(slot, skeleton(2, 40));
      const { drivers } = await api(`/fantasy/races/${race.id}/drivers`);
      const mine = getAuth() ? (await send('GET', '/fantasy/me', undefined).catch(() => ({ predictions: [] }))).predictions.find((p) => p.raceId === race.id) : null;
      const sel = [1, 2, 3].map((n) => h('select', { 'aria-label': `${n}위 예측`, required: true },
        h('option', { value: '' }, `${n}위 선택`), drivers.map((d) => h('option', { value: d.id, selected: mine?.[`p${n}`] === d.id }, `${d.code} · ${d.name}`))));
      const msg = h('p', { class: 'form-msg', role: 'status' });
      const save = h('button', { class: 'btn primary', type: 'submit' }, mine ? '예측 수정' : '예측 저장');
      const form = h('form', { class: 'card form', style: 'max-width:480px' },
        h('div', { class: 'muted' }, `마감 ${kstDate(race.deadline)} ${kstTime(race.deadline)} (한국 시간)`), ...sel, msg, save);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!getAuth()) { location.href = `/login.html?next=${encodeURIComponent(location.pathname + location.search)}`; return; }
        save.disabled = true; msg.textContent = '';
        try {
          await send('PUT', `/fantasy/predictions/${race.id}`, { p1: sel[0].value, p2: sel[1].value, p3: sel[2].value });
          msg.textContent = '저장했습니다. 마감 전에는 다시 바꿀 수 있습니다.';
          renderMine();
        } catch (err) { msg.textContent = err.message; }
        save.disabled = false;
      });
      mount(slot, ...(getAuth() ? [] : [h('p', { class: 'muted' }, '예측을 저장하려면 로그인이 필요합니다.')]), form);
    };
    pick.addEventListener('change', draw);
    mount(formBox, block('예측하기', h('div', { class: 'stack' }, pick, slot)));
    draw();
  } catch (err) { mount(formBox, emptyState(err.message)); }
}

function renderMine() {
  if (!getAuth()) return mount(mineBox, emptyState('로그인하면 내 예측과 점수를 볼 수 있습니다.'));
  load(mineBox, () => send('GET', `/fantasy/me${season ? `?season=${season}` : ''}`), ({ predictions }) => {
    if (!predictions.length) return emptyState('아직 예측이 없습니다.');
    return table([
      { label: 'R', render: (p) => p.round },
      { label: '그랑프리', render: (p) => p.name },
      { label: '내 예측', render: (p) => p.pick.join(' · ') },
      { label: '실제 포디움', render: (p) => (p.podium ? p.podium.join(' · ') : '결과 대기'), class: 'muted' },
      { label: '점수', align: 'right', render: (p) => (p.score == null ? '–' : h('b', null, `${p.score}점 (자리 ${p.exact}개)`)) },
    ], predictions);
  });
}

function renderRanking() {
  load(rankBox, () => api('/fantasy/ranking', { season }), ({ ranking }) => {
    if (!ranking.length) return emptyState('채점된 예측이 아직 없습니다. 레이스 결과가 들어오면 자동으로 채점됩니다.');
    return table([
      { label: '순위', render: (r) => h('span', { class: 'pos num' }, r.rank) },
      { label: '닉네임', render: (r) => h('b', null, r.nickname) },
      { label: '점수', align: 'right', render: (r) => r.score },
      { label: '자리 적중', align: 'right', render: (r) => r.exact },
      { label: '예측 정확도', align: 'right', render: (r) => `${Math.round(r.accuracy * 100)}%`, class: 'muted' },
      { label: '채점된 예측', align: 'right', render: (r) => r.scored, class: 'muted' },
    ], ranking);
  });
}

renderForm(); renderMine(); renderRanking();
