// 팀 상세: 시즌 요약, 소속 드라이버, 라운드별 팀 포인트 막대 + 결과표.
import { h } from '../dom.js';
import { api, urlParam } from '../api.js';
import { mountLayout, profileTabs } from '../layout.js';
import { load, table, emptyState } from '../ui.js';
import { barChart } from '../charts/bar.js';
import { teamColor } from '../teams.js';
import { points } from '../format.js';

mountLayout('profiles');
const body = h('div', { class: 'stack' });
document.getElementById('app').append(profileTabs('teams'), body);

const stat = (label, value) => h('div', { class: 'card' }, h('div', { class: 'label' }, label), h('div', { class: 'big num' }, value));

load(body, () => api(`/teams/${encodeURIComponent(urlParam('id') ?? '')}`, { season: urlParam('season') }), (d) => {
  const color = teamColor(d.team.id, d.team.color);
  const st = d.standing;
  const columns = [
    { label: 'R', render: (r) => r.round },
    { label: '그랑프리', render: (r) => h('a', { href: `/results.html?race=${r.raceId}&season=${d.season}` }, r.raceName) },
    { label: '드라이버별 결승(포인트)', render: (r) => r.drivers.map((x) => `${x.code} ${x.position ?? '–'}위 (${points(x.points)})`).join('  ·  ') },
    { label: '팀 포인트', align: 'right', render: (r) => h('b', null, points(r.points)) },
  ];
  return [
    h('div', { class: 'head-bar', style: `--c:${color}` }, h('h1', null, d.team.name), h('div', { class: 'facts' }, h('span', { class: 'chip' }, `${d.season} 시즌`))),
    st ? h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fit,minmax(180px,1fr))' },
      stat('컨스트럭터 순위', `${st.position}위`), stat('포인트', points(st.points)), stat('우승', st.wins),
      stat('선두와 격차', st.gapToLeader ? `-${points(st.gapToLeader)}` : '선두'))
      : emptyState('이 시즌의 순위 기록이 없습니다.'),
    h('section', null, h('div', { class: 'section-title' }, h('h2', null, '소속 드라이버')),
      h('div', { class: 'cards' }, d.drivers.map((x) =>
        h('a', { class: 'pcard', href: `/driver.html?id=${encodeURIComponent(x.id)}&season=${d.season}`, style: `--c:${color}` },
          h('div', { class: 'no num' }, x.number ?? '–'), h('div', { class: 'nm' }, x.name), h('div', { class: 'muted' }, x.nationality ?? ''))))),
    d.results.length ? h('section', null, h('div', { class: 'section-title' }, h('h2', null, '라운드별 팀 포인트')),
      barChart({ items: d.results.map((r) => ({ label: `R${r.round}`, value: r.points, color })), horizontal: false, format: points, title: '라운드별 팀 포인트' })) : null,
    h('section', null, h('div', { class: 'section-title' }, h('h2', null, `${d.season} 시즌 결과`)),
      d.results.length ? table(columns, d.results) : emptyState('이 시즌의 결과가 없습니다.')),
  ];
});
