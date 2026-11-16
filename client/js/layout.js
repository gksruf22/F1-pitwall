// 공통 헤더·푸터. 페이지마다 mountLayout()만 호출한다.
import { h, mount } from './dom.js';
import { api, urlParam, setUrlParams } from './api.js';

const NAV = [
  { key: 'home', href: '/', label: '대시보드' },
  { key: 'schedule', href: '/schedule.html', label: '일정·결과·순위' },
  { key: 'profiles', href: '/drivers.html', label: '드라이버·팀·서킷' },
  { key: 'analysis', href: '/consistency.html', label: '분석' },
  { key: 'news', href: '/news.html', label: '뉴스' },
];

function themeButton() {
  const btn = h('button', { class: 'btn', 'aria-label': '테마 전환' });
  const sync = () => { btn.textContent = document.documentElement.dataset.theme === 'light' ? '다크 모드' : '라이트 모드'; };
  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch { /* 저장 불가 시 이번 방문에만 적용 */ }
    sync();
  });
  sync();
  return btn;
}

// 시즌 선택기: 선택값은 URL(?season=)에 둔다. 값이 없으면 서버가 최신 시즌을 쓴다.
function seasonSelect() {
  const sel = h('select', { 'aria-label': '시즌' });
  sel.addEventListener('change', () => setUrlParams({ season: sel.value, round: null, race: null }));
  api('/seasons').then(({ seasons }) => {
    const cur = urlParam('season') ?? String(seasons[0]);
    sel.replaceChildren(...seasons.map((y) => h('option', { value: y, selected: String(y) === cur }, `${y} 시즌`)));
  }).catch(() => sel.replaceChildren(h('option', null, '시즌')));
  return sel;
}

// 통합 검색: 입력하고 Enter → /search.html?q=
function searchBox() {
  const input = h('input', { class: 'search', type: 'search', name: 'q', placeholder: '검색', 'aria-label': '통합 검색', minlength: 2, maxlength: 50, value: location.pathname === '/search.html' ? (urlParam('q') ?? '') : '' });
  return h('form', { action: '/search.html', role: 'search' }, input);
}

export function mountLayout(active) {
  const header = document.getElementById('app-header');
  header.className = 'site-header';
  mount(header,
    h('a', { class: 'logo', href: '/' }, 'F1 ', h('b', null, 'PITWALL')),
    h('nav', { class: 'nav', 'aria-label': '주 메뉴' }, NAV.map((n) =>
      h('a', { href: n.href, 'aria-current': n.key === active ? 'page' : null }, n.label))),
    h('div', { class: 'tools' }, searchBox(), seasonSelect(), themeButton()));

  const footer = document.getElementById('app-footer');
  footer.className = 'site-footer';
  mount(footer,
    h('span', null, 'F1 PITWALL은 비공식 팬 프로젝트이며 Formula 1과 제휴 관계가 없습니다.'),
    h('span', null, '데이터: Jolpica F1 · 시간은 한국 시간(KST)'));
}

// 일정·결과·순위 페이지 공통 탭 (같은 시즌을 유지)
export function sectionTabs(active) {
  const season = urlParam('season');
  const q = season ? `?season=${encodeURIComponent(season)}` : '';
  return h('nav', { class: 'tabs', 'aria-label': '일정·결과·순위' }, [
    ['schedule', '/schedule.html', '일정'],
    ['results', '/results.html', '결과'],
    ['standings', '/standings.html', '순위'],
  ].map(([key, href, label]) => h('a', { href: href + q, 'aria-current': key === active ? 'page' : null }, label)));
}

// 드라이버·팀·서킷 페이지 공통 탭
export function profileTabs(active) {
  const season = urlParam('season');
  const q = season ? `?season=${encodeURIComponent(season)}` : '';
  return h('nav', { class: 'tabs', 'aria-label': '드라이버·팀·서킷' }, [
    ['drivers', '/drivers.html', '드라이버'],
    ['teams', '/teams.html', '팀'],
    ['circuits', '/circuits.html', '서킷'],
  ].map(([key, href, label]) => h('a', { href: href + q, 'aria-current': key === active ? 'page' : null }, label)));
}

// 분석 페이지 공통 탭 (일관성 · 드라이버 비교)
export function analysisTabs(active) {
  const season = urlParam('season');
  const q = season ? `?season=${encodeURIComponent(season)}` : '';
  return h('nav', { class: 'tabs', 'aria-label': '분석' }, [
    ['consistency', '/consistency.html', '일관성'],
    ['h2h', '/h2h.html', '드라이버 비교'],
  ].map(([key, href, label]) => h('a', { href: href + q, 'aria-current': key === active ? 'page' : null }, label)));
}
