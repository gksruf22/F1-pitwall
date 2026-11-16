// 드라이버 상세의 "Driver Stats" 탭: 요약 4칸, 카드 4개(라운드별 미니 막대), 포인트권 도넛, 순위 분포, 전년 대비 추이, 선두 랩.
import { h } from './dom.js';
import { api } from './api.js';
import { load, emptyState } from './ui.js';
import { miniBars } from './charts/mini.js';
import { donut } from './charts/donut.js';
import { barChart } from './charts/bar.js';
import { lineChart } from './chart-line.js';
import { teamColor } from './teams.js';
import { points } from './format.js';

const stat = (label, value, note) => h('div', { class: 'card' }, h('div', { class: 'label' }, label), h('div', { class: 'big num' }, value), note && h('div', { class: 'muted' }, note));
const section = (title, node, note) => h('section', null, h('div', { class: 'section-title' }, h('h2', null, title), note && h('span', { class: 'muted' }, note)), node);
const sign = (n) => (n > 0 ? `+${points(n)}` : points(n));

// 카드 하나: 총합 + 라운드별 미니 막대. pick(round) → { race, sprint }
function metricCard(label, total, rounds, pick) {
  return h('div', { class: 'card' }, h('div', { class: 'label' }, label), h('div', { class: 'big num' }, total),
    miniBars({ title: `${label} 라운드별`, items: rounds.map((r) => ({ label: `R${r.round} ${r.raceName}`, upcoming: !r.done, dnf: r.dnf, ...(r.done ? pick(r) : {}) })) }));
}

export function renderDriverStats(container, id, season) {
  return load(container, () => api(`/analysis/driver-stats/${encodeURIComponent(id)}`, { season }), (d) => {
    if (!d.standing) return emptyState('이 시즌의 기록이 없습니다.');
    const color = teamColor(d.standing.teamId, d.standing.color);
    const s = d.summary, t = d.totals;
    const win = (x) => (x === 1 ? 1 : 0), pod = (x) => (x != null && x <= 3 ? 1 : 0);
    const dist = d.finishDistribution, maxPos = Math.max(0, ...Object.keys(dist).map(Number));
    const led = d.rounds.filter((r) => r.ledLaps);
    return [
      h('div', { class: 'grid cols-4' },
        stat(s.isLeader ? '2위와 격차' : '선두와 격차', s.isLeader ? `+${points(s.gapToP2)}` : `-${points(s.gapToP2)}`, s.isLeader ? '챔피언십 선두' : `${d.standing.position}위`),
        stat('팀 포인트 비중', s.teamShare == null ? '–' : `${s.teamShare.toFixed(0)}%`, d.standing.teamName),
        stat('팀메이트와 격차', s.teammate ? sign(s.teammate.gap) : '–', s.teammate ? `${s.teammate.code} ${points(s.teammate.points)}점` : '팀메이트 없음'),
        stat('평균 피니시', s.avgFinish == null ? '–' : s.avgFinish.toFixed(1), s.teammateAvgFinish != null ? `팀메이트 ${s.teammateAvgFinish.toFixed(1)} (완주 레이스 기준)` : '완주 레이스 기준')),
      h('div', { class: 'legend-dots' },
        h('span', null, h('i', { style: 'background:var(--accent)' }), '레이스'), h('span', null, h('i', { style: 'background:var(--warn)' }), '스프린트'),
        h('span', null, h('i', { style: 'background:var(--down)' }), 'DNF'), h('span', null, h('i', { style: 'border:1px dashed var(--border)' }), '예정')),
      h('div', { class: 'grid cols-4' },
        metricCard('우승', t.wins, d.rounds, (r) => ({ race: win(r.position), sprint: win(r.sprint?.position) })),
        metricCard('포디움', t.podiums, d.rounds, (r) => ({ race: pod(r.position) * (r.dnf ? 0 : 1), sprint: pod(r.sprint?.position) })),
        metricCard('포인트', points(t.points), d.rounds, (r) => ({ race: r.points ?? 0, sprint: r.sprint?.points ?? 0 })),
        metricCard('폴포지션', t.poles, d.rounds, (r) => ({ race: r.pole ? 1 : 0 }))),
      h('div', { class: 'grid cols-2' },
        section('포인트권 피니시', donut({
          slices: [{ label: '포인트 획득', value: d.pointsFinish.points, color: '#22c55e' }, { label: '포인트 없음', value: d.pointsFinish.noPoints, color: '#9a9aa0' }, { label: '리타이어', value: d.pointsFinish.dnf, color: '#ef4444' }].filter((x) => x.value),
          center: { value: String(d.pointsFinish.points + d.pointsFinish.noPoints + d.pointsFinish.dnf), label: '레이스' }, title: '포인트권 피니시 비율' })),
        section('결승 순위 분포', maxPos ? barChart({ items: Array.from({ length: maxPos }, (_, i) => ({ label: `${i + 1}위`, value: dist[i + 1] ?? 0, color })).filter((x) => x.value > 0), title: '결승 순위 분포' }) : emptyState('완주 기록이 없습니다.'), '완주한 순위만 표시')),
      section('누적 포인트 추이', d.trend.length ? lineChart({
        series: d.trend.map((x) => ({ id: String(x.season), label: `${x.season} 시즌`, color: x.season === d.season ? color : '#9a9aa0', dashed: x.season !== d.season, values: x.points })),
        xLabels: Array.from({ length: Math.max(...d.trend.map((x) => x.points.length)) }, (_, i) => `R${i + 1}`) })
        : emptyState('비교할 전년 시즌 데이터가 없습니다.'), d.trend.length === 1 ? '전년 시즌은 수집 후 표시' : null),
      section('레이스별 선두 랩', led.length ? barChart({ items: led.map((r) => ({ label: `R${r.round}`, value: r.ledLaps, color })), horizontal: false, title: '레이스별 선두 랩' }) : emptyState('선두를 달린 랩이 없거나 랩 데이터가 없습니다.'), '결승 중 1위로 통과한 랩 수'),
    ];
  });
}
