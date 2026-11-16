// 막대 차트. items: [{ label, value, color }]. horizontal=true면 가로 막대(순위형 비교에 적합).
import { s, h } from '../dom.js';
import { W, chartBox, svgRoot, niceTicks, linear, xAxis, yAxis, label } from './core.js';

export function barChart({ items, horizontal = true, format = String, title = '막대 차트' }) {
  const { box, showTip, hideTip } = chartBox();
  const max = Math.max(...items.map((d) => d.value), 1);
  const ticks = niceTicks(0, max, 5);
  const top = ticks.at(-1);
  const hover = (el, d) => {
    el.addEventListener('pointermove', (e) => showTip(e, [h('b', null, d.label), h('div', null, format(d.value))]));
    el.addEventListener('pointerleave', hideTip);
  };

  if (horizontal) {
    const M = { l: 130, r: 48, t: 8, b: 26 }, row = 28;
    const H = M.t + M.b + items.length * row;
    const svg = svgRoot(H, title);
    const X = linear(0, top, M.l, W - M.r);
    xAxis(svg, ticks, X, M.t, H - M.b, format);
    items.forEach((d, i) => {
      const y = M.t + i * row;
      const bar = s('rect', { x: M.l, y: y + 4, width: Math.max(0, X(d.value) - M.l), height: row - 8, fill: d.color ?? 'var(--accent)', rx: 2 });
      hover(bar, d);
      svg.append(label(M.l - 8, y + row / 2 + 4, d.label, 'end'), bar,
        label(X(d.value) + 6, y + row / 2 + 4, format(d.value)));
    });
    box.append(svg);
  } else {
    const M = { l: 44, r: 12, t: 12, b: 34 }, H = 320;
    const svg = svgRoot(H, title);
    const Y = linear(0, top, H - M.b, M.t);
    yAxis(svg, ticks, Y, M.l, W - M.r, format);
    const slot = (W - M.l - M.r) / items.length;
    items.forEach((d, i) => {
      const bar = s('rect', { x: M.l + i * slot + slot * 0.18, y: Y(d.value), width: slot * 0.64, height: H - M.b - Y(d.value), fill: d.color ?? 'var(--accent)', rx: 2 });
      hover(bar, d);
      svg.append(bar, label(M.l + i * slot + slot / 2, H - 12, d.label, 'middle'));
    });
    box.append(svg);
  }
  return box;
}
