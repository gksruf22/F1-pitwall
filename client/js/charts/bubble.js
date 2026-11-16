// 버블 차트. points: [{ label, x, y, r, color }]. 반지름은 면적에 비례하도록 √ 스케일.
import { s, h } from '../dom.js';
import { W, chartBox, svgRoot, niceTicks, linear, xAxis, yAxis, label } from './core.js';

export function bubble({ points, xLabel = '', yLabel = '', format = String, title = '버블 차트' }) {
  const { box, showTip, hideTip } = chartBox();
  const M = { l: 52, r: 40, t: 16, b: 42 }, H = 380;
  const xt = niceTicks(Math.min(...points.map((p) => p.x)), Math.max(...points.map((p) => p.x)), 6);
  const yt = niceTicks(Math.min(...points.map((p) => p.y)), Math.max(...points.map((p) => p.y)), 5);
  const X = linear(xt[0], xt.at(-1), M.l, W - M.r), Y = linear(yt[0], yt.at(-1), H - M.b, M.t);
  const rMax = Math.max(...points.map((p) => p.r)) || 1;
  const svg = svgRoot(H, title);
  xAxis(svg, xt, X, M.t, H - M.b, format);
  yAxis(svg, yt, Y, M.l, W - M.r, format);
  svg.append(label((M.l + W - M.r) / 2, H - 6, xLabel, 'middle'), label(M.l, M.t - 4, yLabel));
  for (const p of points) {
    const c = s('circle', { cx: X(p.x), cy: Y(p.y), r: 6 + 22 * Math.sqrt(p.r / rMax), fill: p.color ?? 'var(--accent)', 'fill-opacity': 0.55, stroke: p.color ?? 'var(--accent)' });
    c.addEventListener('pointermove', (e) => showTip(e, [h('b', null, p.label), h('div', null, `${xLabel} ${format(p.x)} · ${yLabel} ${format(p.y)}`), h('div', null, `크기 ${format(p.r)}`)]));
    c.addEventListener('pointerleave', hideTip);
    svg.append(c);
  }
  box.append(svg);
  return box;
}
