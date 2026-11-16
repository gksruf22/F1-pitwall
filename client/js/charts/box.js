// 박스플롯(가로). groups: [{ label, color, values: number[] }]. 수염은 1.5×IQR, 그 밖은 점(이상치).
import { s, h } from '../dom.js';
import { W, chartBox, svgRoot, niceTicks, linear, xAxis, label, quantile } from './core.js';

export function boxPlot({ groups, format = String, markers = [], title = '박스플롯' }) {
  const { box, showTip, hideTip } = chartBox();
  const M = { l: 130, r: 40, t: 8, b: 26 }, row = 30;
  const stats = groups.filter((g) => g.values.length).map((g) => {
    const v = [...g.values].sort((a, b) => a - b);
    const q1 = quantile(v, 0.25), med = quantile(v, 0.5), q3 = quantile(v, 0.75), iqr = q3 - q1;
    const inRange = v.filter((x) => x >= q1 - 1.5 * iqr && x <= q3 + 1.5 * iqr);
    return { g, q1, med, q3, lo: inRange[0], hi: inRange.at(-1), out: v.filter((x) => x < inRange[0] || x > inRange.at(-1)), n: v.length };
  });
  const all = [...stats.flatMap((x) => [x.lo, x.hi, ...x.out]), ...markers.map((m) => m.value)];
  const ticks = niceTicks(Math.min(...all), Math.max(...all), 6);
  const H = M.t + M.b + stats.length * row;
  const svg = svgRoot(H, title);
  const X = linear(ticks[0], ticks.at(-1), M.l, W - M.r);
  xAxis(svg, ticks, X, M.t, H - M.b, format);
  // 기준선(예: 포인트권 컷오프)은 점선 + 위쪽 라벨
  markers.forEach((m, i) => svg.append(
    s('line', { x1: X(m.value), x2: X(m.value), y1: M.t, y2: H - M.b, stroke: 'var(--warn)', 'stroke-dasharray': '5 4' }),
    label(X(m.value) + 4, M.t + 12 + i * 14, m.label)));

  stats.forEach((x, i) => {
    const cy = M.t + i * row + row / 2, color = x.g.color ?? 'var(--accent)';
    const grp = s('g', null,
      s('line', { x1: X(x.lo), x2: X(x.hi), y1: cy, y2: cy, stroke: color, 'stroke-width': 1.5 }),
      s('rect', { x: X(x.q1), y: cy - 9, width: Math.max(1, X(x.q3) - X(x.q1)), height: 18, fill: color, 'fill-opacity': 0.35, stroke: color, rx: 2 }),
      s('line', { x1: X(x.med), x2: X(x.med), y1: cy - 9, y2: cy + 9, stroke: 'var(--text)', 'stroke-width': 2 }),
      x.out.map((o) => s('circle', { cx: X(o), cy, r: 2.5, fill: color })));
    const hit = s('rect', { x: 0, y: cy - row / 2, width: W, height: row, fill: 'transparent' });
    hit.addEventListener('pointermove', (e) => showTip(e, [h('b', null, x.g.label),
      h('div', null, `중앙값 ${format(x.med)}`), h('div', null, `Q1 ${format(x.q1)} · Q3 ${format(x.q3)}`),
      h('div', null, `최소 ${format(x.lo)} · 최대 ${format(x.hi)}`), h('div', null, `표본 ${x.n}개`)]));
    hit.addEventListener('pointerleave', hideTip);
    svg.append(label(M.l - 8, cy + 4, x.g.label, 'end'), grp, hit);
  });
  box.append(svg);
  return box;
}
