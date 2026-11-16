// 점 스트립/스웜(가로). groups: [{ label, color, values }]. 겹치는 점은 위아래로 비켜 놓는다(간단한 비스웜).
import { s, h } from '../dom.js';
import { W, chartBox, svgRoot, niceTicks, linear, xAxis, label } from './core.js';

export function stripPlot({ groups, format = String, title = '점 스트립' }) {
  const { box, showTip, hideTip } = chartBox();
  const M = { l: 130, r: 40, t: 8, b: 26 }, row = 34, R = 3.5;
  const all = groups.flatMap((g) => g.values);
  const ticks = niceTicks(Math.min(...all), Math.max(...all), 6);
  const H = M.t + M.b + groups.length * row;
  const svg = svgRoot(H, title);
  const X = linear(ticks[0], ticks.at(-1), M.l, W - M.r);
  xAxis(svg, ticks, X, M.t, H - M.b, format);

  groups.forEach((g, i) => {
    const cy = M.t + i * row + row / 2, placed = [];
    svg.append(label(M.l - 8, cy + 4, g.label, 'end'));
    for (const v of [...g.values].sort((a, b) => a - b)) {
      const x = X(v);
      // 0, +d, -d, +2d … 순으로 겹치지 않는 첫 위치를 고른다(한 줄 높이를 넘지 않게 제한).
      let dy = 0;
      for (let k = 1; placed.some((p) => Math.hypot(p.x - x, p.y - dy) < R * 2); k++) {
        dy = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * R * 1.9;
        if (Math.abs(dy) > row / 2 - R) break;
      }
      placed.push({ x, y: dy });
      const dot = s('circle', { cx: x, cy: cy + dy, r: R, fill: g.color ?? 'var(--accent)', 'fill-opacity': 0.85 });
      dot.addEventListener('pointermove', (e) => showTip(e, [h('b', null, g.label), h('div', null, format(v))]));
      dot.addEventListener('pointerleave', hideTip);
      svg.append(dot);
    }
  });
  box.append(svg);
  return box;
}
