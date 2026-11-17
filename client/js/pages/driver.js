// 드라이버 상세: 헤더 요약 + 시즌 결과표(예선·그리드·결승·포인트·스프린트).
import { h } from '../dom.js';
import { api, urlParam } from '../api.js';
import { mountLayout, profileTabs } from '../layout.js';
import { renderDriverStats } from '../driver-stats.js';
import { load, table, emptyState, tabs } from '../ui.js';
import { setUrlParams } from '../api.js';
import { teamColor } from '../teams.js';
import { points } from '../format.js';
import { favoriteButton } from '../favorite.js';

mountLayout('profiles');
const app = document.getElementById('app');
const body = h('div', { class: 'stack' });
app.append(profileTabs('drivers'), body);

const age = (birth) => (birth ? Math.floor((Date.now() - new Date(birth)) / 31557600000) : null);
const stat = (label, value) => h('div', { class: 'card' }, h('div', { class: 'label' }, label), h('div', { class: 'big num' }, value));
const dash = (v) => v ?? '–';
const tab = urlParam('tab') === 'stats' ? 'stats' : 'profile';
const statsBox = h('div', { class: 'stack' });

load(body, () => api(`/drivers/${encodeURIComponent(urlParam('id') ?? '')}`, { season: urlParam('season') }), (d) => {
  if (tab === 'stats') renderDriverStats(statsBox, d.driver.id, d.season);
  const color = teamColor(d.entry?.teamId, d.entry?.color);
  const st = d.standing;
  const columns = [
    { label: 'R', render: (r) => r.round },
    { label: '그랑프리', render: (r) => h('a', { href: `/results.html?race=${r.raceId}&season=${d.season}` }, r.raceName) },
    { label: '예선', align: 'right', render: (r) => dash(r.qualiPosition) },
    { label: '그리드', align: 'right', render: (r) => (r.grid === 0 ? 'PL' : dash(r.grid)) },
    { label: '결승', align: 'right', render: (r) => h('b', null, dash(r.position)) },
    { label: '포인트', align: 'right', render: (r) => (r.points ? points(r.points) : '–') },
    { label: '스프린트', align: 'right', render: (r) => (r.sprintPosition ? `${r.sprintPosition}위 (${points(r.sprintPoints ?? 0)})` : '–') },
    { label: '비고', render: (r) => (r.fastest ? h('span', { class: 'chip fastest' }, '패스티스트랩') : h('span', { class: 'muted' }, r.status && r.status !== 'Finished' ? r.status : '')) },
  ];
  return [
    h('div', { class: 'head-bar', style: `--c:${color}` },
      h('h1', null, d.driver.name),
      h('div', { class: 'facts' },
        favoriteButton('driver', d.driver.id),
        d.entry && h('span', { class: 'chip' }, `#${d.entry.number}`),
        d.entry && h('a', { class: 'chip', href: `/team.html?id=${encodeURIComponent(d.entry.teamId)}&season=${d.season}` }, d.entry.teamName),
        d.driver.nationality && h('span', { class: 'chip' }, d.driver.nationality),
        d.driver.birth && h('span', { class: 'chip' }, `${d.driver.birth} (만 ${age(d.driver.birth)}세)`),
        h('span', { class: 'chip' }, `${d.season} 시즌`))),
    tab === 'profile' && st ? h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fit,minmax(180px,1fr))' },
      stat('시즌 순위', `${st.position}위`), stat('포인트', points(st.points)), stat('우승', st.wins),
      stat('선두와 격차', st.gapToLeader ? `-${points(st.gapToLeader)}` : '선두'))
      : (tab === 'profile' ? emptyState('이 시즌의 순위 기록이 없습니다.') : null),
    tabs([{ key: 'profile', label: '프로필' }, { key: 'stats', label: 'Driver Stats' }], tab, (k) => setUrlParams({ tab: k === 'stats' ? 'stats' : null })),
    tab === 'stats' ? statsBox : h('section', null, h('div', { class: 'section-title' }, h('h2', null, `${d.season} 시즌 결과`)),
      d.results.length ? table(columns, d.results) : emptyState('이 시즌의 결과가 없습니다.')),
  ];
});
