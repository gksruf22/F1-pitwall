// 점 스트립/스웜(가로). groups: [{ label, color, values }]. 값은 숫자 또는 { v, color?, note? }. 겹치는 점은 위아래로 비켜 놓는다(간단한 비스웜).
// zero: true면 0 기준선을 그린다(좌우 비교용).
import { s, h } from '../dom.js';
import { W, chartBox, svgRoot, niceTicks, linear, xAxis, label } from './core.js';

export function stripPlot({ groups, format = String, zero = false, left = 130, title = '점 스트립' }) {
  const val = (x) => (typeof x === 'object' ? x.v : x);
  const { box, showTip, hideTip } = chartBox();
  const M = { l: left, r: 40, t: 8, b: 26 }, row = 34, R = 3.5;
  const all = groups.flatMap((g) => g.values.map(val)).concat(zero ? [0] : []);
  const ticks = niceTicks(Math.min(...all), Math.max(...all), 6);
  const H = M.t + M.b + groups.length * row;
  const svg = svgRoot(H, title);
  const X = linear(ticks[0], ticks.at(-1), M.l, W - M.r);
  xAxis(svg, ticks, X, M.t, H - M.b, format);
  if (zero) svg.append(s('line', { x1: X(0), x2: X(0), y1: M.t, y2: H - M.b, stroke: 'var(--muted)', 'stroke-width': 1.5 }));

  groups.forEach((g, i) => {
    const cy = M.t + i * row + row / 2, placed = [];
    svg.append(label(M.l - 8, cy + 4, g.label, 'end'));
    for (const pt of [...g.values].sort((a, b) => val(a) - val(b))) {
      const v = val(pt), x = X(v);
      // 0, +d, -d, +2d … 순으로 겹치지 않는 첫 위치를 고른다(한 줄 높이를 넘지 않게 제한).
      let dy = 0;
      for (let k = 1; placed.some((p) => Math.hypot(p.x - x, p.y - dy) < R * 2); k++) {
        dy = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * R * 1.9;
        if (Math.abs(dy) > row / 2 - R) break;
      }
      placed.push({ x, y: dy });
      const dot = s('circle', { cx: x, cy: cy + dy, r: R, fill: pt.color ?? g.color ?? 'var(--accent)', 'fill-opacity': 0.85 });
      dot.addEventListener('pointermove', (e) => showTip(e, [h('b', null, g.label), h('div', null, format(v)), pt.note && h('div', { class: 'muted' }, pt.note)].filter(Boolean)));
      dot.addEventListener('pointerleave', hideTip);
      svg.append(dot);
    }
  });
  box.append(svg);
  return box;
}
