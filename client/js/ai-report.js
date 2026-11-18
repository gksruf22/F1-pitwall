// 결과 페이지의 AI 레이스 요약 카드. 저장된 리포트가 있으면 보여 주고, 없으면 로그인 사용자가 생성할 수 있다.
import { h, mount } from './dom.js';
import { api } from './api.js';
import { getAuth, send } from './auth.js';
import { kstDate } from './format.js';

// [라벨, 값 → 문장]
const FACTS = {
  pole: ['폴 포지션', (v) => v],
  total_laps: ['총 랩', (v) => `${v}랩`],
  fastest_lap: ['패스티스트 랩', (v) => `${v.driver} ${v.time}`],
  biggest_gain: ['최다 순위 상승', (v) => `${v.driver} ${v.from_grid}번 그리드 → ${v.to_position}위 (${v.gained}계단)`],
  top10: ['Top 10', (v) => v.map((r) => `${r.position}. ${r.driver} (${r.team}, 그리드 ${r.grid}${r.pit_stops ? `, 피트 ${r.pit_stops}회` : ''})`).join(' · ')],
  not_classified: ['리타이어·미분류', (v) => v.map((r) => `${r.driver} (${r.status})`).join(' · ')],
  lead_changes: ['선두 교체', (v) => v.map((r) => `${r.from_lap}랩 ${r.leader}`).join(' → ')],
  laps_led: ['선두 랩 수', (v) => v.map((r) => `${r.driver} ${r.laps}랩`).join(' · ')],
  safety_car: ['세이프티카', (v) => v.map((r) => `${r.lap}랩 ${r.message}`).join(' · ')],
};

function evidence(facts) {
  return h('details', { class: 'evidence' }, h('summary', null, '근거 데이터 (DB에서 계산한 값)'),
    h('dl', { class: 'facts-list' }, Object.entries(FACTS).filter(([k]) => facts[k] != null && !(Array.isArray(facts[k]) && !facts[k].length))
      .flatMap(([k, [label, text]]) => [h('dt', null, label), h('dd', null, text(facts[k]))])));
}

export function aiReportCard(raceId) {
  const card = h('section', { class: 'card ai-report', 'aria-label': 'AI 레이스 요약' });
  const render = ({ facts, report }) => {
    const head = h('div', { class: 'msg-head' }, h('h2', { class: 'section-title' }, 'AI 레이스 요약'), h('span', { class: 'chip' }, 'AI 생성 내용'));
    if (report) {
      return mount(card, head, ...report.text.split(/\n+/).map((p) => h('p', null, p)),
        h('p', { class: 'muted small' }, `${kstDate(report.createdUtc)} 생성 · 숫자는 아래 근거 데이터와 일치하는지 서버가 확인했습니다.`), evidence(facts));
    }
    const msg = h('p', { class: 'form-msg', role: 'alert' });
    const btn = getAuth()
      ? h('button', { class: 'btn primary', type: 'button' }, '리포트 만들기')
      : h('a', { class: 'btn', href: `/login.html?next=${encodeURIComponent(location.pathname + location.search)}` }, '로그인하고 리포트 만들기');
    if (getAuth()) {
      btn.addEventListener('click', async () => {
        btn.disabled = true; btn.textContent = '만드는 중… (10~20초)'; msg.textContent = '';
        try { render(await send('POST', `/ai/report/${raceId}`)); } catch (err) {
          msg.textContent = err.message; btn.disabled = false; btn.textContent = '다시 시도';
        }
      });
    }
    mount(card, head, h('p', { class: 'muted' }, '아직 이 레이스의 리포트가 없습니다. 한 번 만들면 모두가 함께 봅니다.'), btn, msg, evidence(facts));
  };
  mount(card, h('div', { class: 'skeleton', style: 'height:120px' }));
  api(`/ai/report/${raceId}`).then(render).catch((err) => mount(card, h('p', { class: 'muted' }, `AI 요약을 불러오지 못했습니다: ${err.message}`)));
  return card;
}
