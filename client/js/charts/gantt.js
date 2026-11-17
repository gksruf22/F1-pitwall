// 구간 막대(스틴트용). rows: [{ label, segs: [{ from, to, color, text?, tip: [문자열…] }] }], total: x축 끝(랩 수).
// 구간은 from~to를 닫힌 구간으로 보고 (to - from + 1)칸 너비로 그린다.
import { s, h } from '../dom.js';
import { W, chartBox, svgRoot, niceTicks, linear, xAxis, label } from './core.js';

export function gantt({ rows, total, title = '구간 막대' }) {
  const { box, showTip, hideTip } = chartBox();
  const M = { l: 60, r: 16, t: 6, b: 26 }, row = 26;
  const H = M.t + M.b + rows.length * row;
  const svg = svgRoot(H, title);
  const X = linear(0, total, M.l, W - M.r);
  xAxis(svg, niceTicks(0, total, 8).filter((v) => v <= total), X, M.t, H - M.b);
  rows.forEach((r, i) => {
    const y = M.t + i * row;
    svg.append(label(M.l - 8, y + row / 2 + 4, r.label, 'end'));
    for (const g of r.segs) {
      const x = X(g.from - 1), w = Math.max(2, X(g.to) - x);
      const rect = s('rect', { x: x + 0.5, y: y + 4, width: w - 1, height: row - 8, rx: 3, fill: g.color });
      rect.addEventListener('pointermove', (e) => showTip(e, g.tip.map((t, k) => (k ? h('div', null, t) : h('b', null, t)))));
      rect.addEventListener('pointerleave', hideTip);
      svg.append(rect);
      if (g.text && w > 28) svg.append(s('text', { x: x + w / 2, y: y + row / 2 + 4, 'text-anchor': 'middle', style: 'fill:#111;font-size:11px;font-weight:700;pointer-events:none' }, g.text));
    }
  });
  box.append(svg);
  return box;
}
