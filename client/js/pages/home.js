// 대시보드: 히어로 캐러셀(다음 GP / 드라이버 1위 / 컨스트럭터 1위), 직전 포디움, 요약 카드, 순위 Top 5.
import { h } from '../dom.js';
import { api, urlParam } from '../api.js';
import { mountLayout } from '../layout.js';
import { load, table, colorBar, change, skeleton } from '../ui.js';
import { teamColor } from '../teams.js';
import { kstDate, kstTime, parts, points } from '../format.js';
import { newsItem } from '../news-item.js';
import { mount } from '../dom.js';

mountLayout('home');
const app = document.getElementById('app');
const root = h('div', { class: 'stack' });
app.append(root);

// ---- 히어로 ----
function countdown(startUtc) {
  const cells = { d: h('b'), h: h('b'), m: h('b'), s: h('b') };
  const box = h('div', { class: 'cd', role: 'timer' },
    ...[['d', '일'], ['h', '시간'], ['m', '분'], ['s', '초']].map(([k, label]) => h('div', null, cells[k], h('span', null, label))));
  const tick = () => {
    const p = parts(new Date(startUtc) - Date.now());
    for (const k of Object.keys(cells)) cells[k].textContent = String(p[k]).padStart(2, '0');
  };
  tick();
  setInterval(tick, 1000);
  return box;
}

function slideNextRace(race) {
  const start = race?.sessions?.find((x) => x.type === 'R')?.startUtc;
  return h('div', { class: 'slide' },
    h('div', { class: 'panel' },
      h('span', { class: 'chip accent' }, '다음 그랑프리'),
      h('h2', null, race ? race.name : '이번 시즌 일정이 모두 끝났습니다'),
      race && h('div', { class: 'muted' }, `${race.circuit_name ?? ''} · ${race.round}라운드`),
      start && h('div', { class: 'muted' }, `${kstDate(start)} ${kstTime(start)} (KST)`)),
    start && h('div', { class: 'chip-box' }, h('div', { class: 'l' }, '결승까지'), countdown(start)));
}

function slideLeader(label, entry, sub) {
  const color = entry ? teamColor(entry.teamId ?? entry.id, entry.color) : '#888';
  return h('div', { class: 'slide' },
    h('div', { class: 'stripe', style: `background:${color}` }),
    h('div', { class: 'panel' },
      h('span', { class: 'chip accent' }, label),
      h('h2', null, entry?.name ?? '데이터 없음'),
      entry && h('div', { class: 'muted' }, sub(entry))),
    entry && h('div', { class: 'chip-box lead' }, h('div', { class: 'v num' }, points(entry.points)), h('div', { class: 'l' }, 'POINTS')));
}

function carousel(slides) {
  const wrap = h('section', { class: 'hero', 'aria-roledescription': 'carousel', 'aria-label': '시즌 하이라이트' });
  const dots = h('div', { class: 'dots' });
  let i = 0, timer;
  const show = (n) => {
    i = (n + slides.length) % slides.length;
    slides.forEach((el, k) => el.classList.toggle('on', k === i));
    [...dots.children].forEach((d, k) => d.setAttribute('aria-current', k === i ? 'true' : 'false'));
  };
  slides.forEach((_, k) => dots.append(h('button', { 'aria-label': `${k + 1}번 슬라이드`, onclick: () => { show(k); restart(); } })));
  const restart = () => {
    clearInterval(timer);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(() => show(i + 1), 7000);
  };
  wrap.append(...slides,
    h('button', { class: 'arrow prev', 'aria-label': '이전', onclick: () => { show(i - 1); restart(); } }, '‹'),
    h('button', { class: 'arrow next', 'aria-label': '다음', onclick: () => { show(i + 1); restart(); } }, '›'),
    dots);
  show(0); restart();
  return wrap;
}

// ---- 본문 ----
function podium(lastRace, season) {
  if (!lastRace) return h('div', { class: 'state' }, h('p', null, '아직 결과가 나온 레이스가 없습니다.'));
  return h('div', null,
    h('div', { class: 'section-title' }, h('h2', null, `직전 포디움 · ${lastRace.name}`),
      h('a', { href: `/results.html?race=${lastRace.raceId}&season=${season}` }, '전체 결과 →')),
    h('div', { class: 'podium' }, lastRace.podium.map((p) =>
      h('div', { class: `card${p.position === 1 ? ' lead' : ''}` },
        h('div', { class: 'who' }, colorBar(teamColor(p.teamId, p.color)), h('span', { class: 'p num' }, p.position)),
        h('b', null, p.driverName), h('div', { class: 'muted' }, p.teamName ?? '')))));
}

const statCard = (label, value, note, extra) =>
  h('div', { class: 'card' }, h('div', { class: 'label' }, label), h('div', { class: 'big num' }, value),
    h('div', { class: 'muted' }, note), extra);

load(root, async () => {
  const season = urlParam('season');
  const [summary, next] = await Promise.all([api('/summary', { season }), api('/races/next')]);
  return { summary, next: next.race };
}, ({ summary, next }) => {
  const { progress, championship: c, lastRace, topDrivers } = summary;
  const pct = Math.round((progress.done / progress.total) * 100);
  return [
    carousel([
      slideNextRace(next),
      slideLeader('드라이버 챔피언십 1위', c.driverLeader, (e) => `${e.teamName ?? ''} · 우승 ${e.wins}회`),
      slideLeader('컨스트럭터 챔피언십 1위', c.constructorLeader, (e) => `우승 ${e.wins}회`),
    ]),
    podium(lastRace, summary.season),
    h('div', { class: 'grid cols-4' },
      statCard('시즌 진행률', `${progress.done}/${progress.total}`, `${pct}% 완료`,
        h('div', { class: 'progress' }, h('i', { style: `width:${pct}%` }))),
      statCard('드라이버 1·2위 격차', c.driverGap == null ? '–' : `${points(c.driverGap)}점`,
        c.driverLeader ? `${c.driverLeader.name} 선두` : ''),
      statCard('컨스트럭터 1·2위 격차', c.constructorGap == null ? '–' : `${points(c.constructorGap)}점`,
        c.constructorLeader ? `${c.constructorLeader.name} 선두` : ''),
      statCard('최단 피트스톱', summary.fastestPit ? `${(summary.fastestPit.laneMs / 1000).toFixed(3)}초` : '–',
        summary.fastestPit ? `${summary.fastestPit.code} · R${summary.fastestPit.round} ${summary.fastestPit.raceName} (피트레인 통과 시간)` : '피트스톱 데이터 없음')),
    h('section', null,
      h('div', { class: 'section-title' }, h('h2', null, '드라이버 순위 Top 5'), h('a', { href: '/standings.html' }, '전체 순위 →')),
      table([
        { label: '순위', render: (r) => h('span', { class: 'pos num' }, r.position) },
        { label: '드라이버', render: (r) => h('div', { class: 'who' }, colorBar(teamColor(r.teamId, r.color)), h('b', null, r.name)) },
        { label: '팀', render: (r) => r.teamName ?? '–', class: 'muted' },
        { label: '포인트', align: 'right', render: (r) => h('b', null, points(r.points)) },
        { label: '변동', align: 'right', render: (r) => change(r.change) },
      ], topDrivers)),
    highlightsSection(summary.season),
    newsSection(),
  ];
}, skeleton(4, 120));

// ---- 하이라이트 피드(규칙 기반 사실) + 필터 칩 ----
const FILTERS = [['all', '전체'], ['race', '레이스'], ['driver', '드라이버'], ['team', '팀']];

function highlightsSection(season) {
  const list = h('div');
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': '하이라이트 필터' });
  const draw = (filter) => {
    [...chips.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === filter)));
    load(list, () => api('/highlights', { season, filter, limit: 8 }), ({ items }) => items.length
      ? h('ul', { class: 'feed' }, items.map((i) => h('li', null, h('span', { class: 'rnd num' }, `R${i.round}`),
        h('a', { href: `/results.html?race=${i.raceId}&season=${season}`, title: i.template ?? null }, i.text),
        i.ai && h('span', { class: 'chip', title: `AI가 다듬은 문장 · 원문: ${i.template}` }, 'AI'))))
      : h('div', { class: 'state' }, h('p', null, '해당하는 하이라이트가 없습니다.')), skeleton(3, 44));
  };
  chips.append(...FILTERS.map(([f, label]) => h('button', { class: 'chip', 'data-f': f, 'aria-pressed': 'false', onclick: () => draw(f) }, label)));
  draw('all');
  return h('section', null, h('div', { class: 'section-title' }, h('h2', null, '하이라이트')), chips, list);
}

function newsSection() {
  const list = h('div');
  load(list, () => api('/news', { limit: 5 }), ({ items }) => items.length
    ? h('ul', { class: 'feed' }, items.map(newsItem)) : h('div', { class: 'state' }, h('p', null, '저장된 뉴스가 없습니다.')), skeleton(3, 44));
  return h('section', null, h('div', { class: 'section-title' }, h('h2', null, '뉴스'), h('a', { href: '/news.html' }, '더 보기 →')), list);
}
