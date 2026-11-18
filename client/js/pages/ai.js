// AI 어시스턴트: 질문 → 서버(/api/ai/chat)가 DB 조회 함수를 호출해 답하고, 조회한 데이터를 근거로 함께 보여 준다.
import { h, mount } from '../dom.js';
import { mountLayout } from '../layout.js';
import { table, emptyState } from '../ui.js';
import { getAuth, send } from '../auth.js';

mountLayout('ai');

const EXAMPLES = [
  '2025 시즌 드라이버 챔피언과 2위의 점수 차는?',
  '2026 영국 그랑프리 우승자와 가장 빠른 피트스톱은?',
  '2026 이탈리아 그랑프리 노리스의 최고 랩과 평균 랩타임은?',
];
const TOOL_LABEL = {
  get_races: '그랑프리 목록', get_race_results: '세션 결과', get_standings: '챔피언십 순위',
  get_driver_laps: '랩 기록', get_pit_stops: '피트스톱',
};
const history = []; // [{ role: 'user'|'model', text }] — 이 페이지에 있는 동안만 유지

// 답변의 **굵게**만 살리고 나머지는 텍스트로 넣는다(innerHTML 사용 안 함)
function richText(text) {
  return text.split('\n').map((line) => h('p', null,
    line.split('**').map((part, i) => (i % 2 ? h('b', null, part) : part))));
}

// 도구 결과에서 표로 보여 줄 배열(results·standings·laps·stops·races)을 찾는다
function evidenceItem({ name, args, result }) {
  const rows = Object.values(result ?? {}).find(Array.isArray) ?? [];
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const argText = Object.entries(args).map(([k, v]) => `${k}=${v}`).join(', ');
  return h('div', { class: 'evidence-item' },
    h('div', null, h('b', null, TOOL_LABEL[name] ?? name), h('span', { class: 'muted' }, ` ${name}(${argText})`)),
    result?.error || result?.note ? h('p', { class: 'muted' }, result.error ?? result.note) : null,
    result?.summary ? h('p', { class: 'muted num' }, Object.entries(result.summary).map(([k, v]) => `${k}: ${v}`).join(' · ')) : null,
    rows.length ? table(cols.map((c) => ({ label: c, render: (r) => String(r[c] ?? '') })), rows) : null);
}

function answerBlock(d) {
  return h('article', { class: 'msg model' },
    h('div', { class: 'msg-head' }, h('span', { class: 'chip' }, 'AI 생성 내용'),
      h('small', { class: 'muted' }, `오늘 남은 질문 ${d.remaining}회`)),
    ...richText(d.answer),
    d.evidence.length
      ? h('details', { class: 'evidence' }, h('summary', null, `근거 데이터 (조회 ${d.evidence.length}건)`), d.evidence.map(evidenceItem))
      : h('p', { class: 'muted small' }, '조회한 데이터 없이 답한 내용입니다.'));
}

const log = h('div', { class: 'chat-log', 'aria-live': 'polite' });
const input = h('textarea', { rows: 2, maxlength: 500, placeholder: '예: 2025 시즌 컨스트럭터 순위 알려줘', 'aria-label': '질문' });
const count = h('small', { class: 'muted num' }, '0 / 500');
const submit = h('button', { class: 'btn primary', type: 'submit' }, '질문');
const form = h('form', { class: 'card chat-form' }, input, h('div', { class: 'actions' }, count, submit));

input.addEventListener('input', () => { count.textContent = `${input.value.length} / 500`; });
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
});

async function ask(question) {
  if (!question || submit.disabled) return;
  if (!history.length) log.replaceChildren();
  log.append(h('article', { class: 'msg user' }, h('p', null, question)));
  const pending = h('article', { class: 'msg model', 'aria-busy': 'true' }, h('p', { class: 'muted' }, '데이터를 조회하며 답을 만드는 중…'));
  log.append(pending);
  input.value = ''; count.textContent = '0 / 500'; submit.disabled = true;
  pending.scrollIntoView({ block: 'nearest' });
  try {
    const d = await send('POST', '/ai/chat', { question, history });
    history.push({ role: 'user', text: question }, { role: 'model', text: d.answer });
    pending.replaceWith(answerBlock(d));
  } catch (err) {
    pending.replaceWith(h('article', { class: 'msg model state error', role: 'alert' }, h('p', null, err.message),
      h('button', { class: 'btn', type: 'button', onclick: (e) => { e.target.closest('article').previousSibling.remove(); e.target.closest('article').remove(); ask(question); } }, '다시 시도')));
  } finally {
    submit.disabled = false; input.focus();
  }
}
form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value.trim()); });

log.append(emptyState('F1 결과·순위·랩·피트스톱 데이터를 물어보세요. 답의 숫자는 사이트 DB에서 조회한 값입니다.'),
  h('div', { class: 'chips' }, EXAMPLES.map((q) => h('button', { class: 'chip', type: 'button', onclick: () => ask(q) }, q))));

mount(document.getElementById('app'),
  h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'AI 어시스턴트'),
    h('div', { class: 'sub' }, `사이트 DB를 조회해 답합니다 · ${getAuth() ? '로그인: 하루 30회' : '비로그인: 하루 5회 (로그인 시 30회)'}`))),
  h('div', { class: 'stack' }, log, form,
    h('p', { class: 'muted small' }, 'AI가 생성한 문장은 틀릴 수 있습니다. 숫자는 "근거 데이터"에서 확인하세요. 질문 내용은 Google Gemini API로 전송됩니다.')));
