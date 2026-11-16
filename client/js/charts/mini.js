// 라운드별 미니 막대. items: [{ label, race, sprint, dnf, upcoming }] — race·sprint는 막대 높이 값.
// 색: 레이스=악센트, 스프린트=노랑, DNF=빨강 X, 예정=점선 막대.
import { s } from '../dom.js';
import { chartBox, svgRoot } from './core.js';

export function miniBars({ items, title = '라운드별 미니 막대' }) {
  const { box } = chartBox();
  box.style.cssText = 'padding:8px 0 0;border:0;background:none';
  const W = 400, H = 64, base = H - 6;
  const max = Math.max(1, ...items.map((d) => (d.race ?? 0) + (d.sprint ?? 0)));
  const slot = W / items.length, bw = slot * 0.62;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': title });
  items.forEach((d, i) => {
    const x = i * slot + (slot - bw) / 2;
    const tip = s('title', null, `${d.label}${d.upcoming ? ' (예정)' : ''}`);
    if (d.upcoming) { svg.append(s('g', null, tip, s('rect', { x, y: base - 8, width: bw, height: 8, fill: 'none', stroke: 'var(--border)', 'stroke-dasharray': '2 2' }))); return; }
    const r = ((d.race ?? 0) / max) * (base - 4), sp = ((d.sprint ?? 0) / max) * (base - 4);
    const g = s('g', null, tip);
    if (d.dnf) g.append(s('text', { x: x + bw / 2, y: base - 2, 'text-anchor': 'middle', style: 'fill:var(--down);font-size:11px;font-weight:700' }, '✕'));
    if (r > 0) g.append(s('rect', { x, y: base - r, width: bw, height: r, fill: 'var(--accent)', rx: 1 }));
    if (sp > 0) g.append(s('rect', { x, y: base - r - sp, width: bw, height: sp, fill: 'var(--warn)', rx: 1 }));
    if (!d.dnf && r === 0 && sp === 0) g.append(s('rect', { x, y: base - 1.5, width: bw, height: 1.5, fill: 'var(--muted)' }));
    svg.append(g);
  });
  box.append(svg);
  return box;
}
