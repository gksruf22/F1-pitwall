// 히트맵. rows/cols: 라벨 배열, values[r][c]: 숫자(없으면 null). 값이 클수록 진한 악센트 색.
import { s, h } from '../dom.js';
import { W, chartBox, svgRoot, label } from './core.js';

export function heatmap({ rows, cols, values, min, max, format = String, title = '히트맵' }) {
  const { box, showTip, hideTip } = chartBox();
  const flat = values.flat().filter((v) => v != null);
  const lo = min ?? Math.min(...flat), hi = max ?? Math.max(...flat);
  const M = { l: 130, r: 12, t: 28, b: 8 };
  const cw = (W - M.l - M.r) / cols.length, ch = 34;
  const H = M.t + M.b + rows.length * ch;
  const svg = svgRoot(H, title);
  cols.forEach((c, j) => svg.append(label(M.l + j * cw + cw / 2, M.t - 10, c, 'middle')));
  rows.forEach((r, i) => {
    svg.append(label(M.l - 8, M.t + i * ch + ch / 2 + 4, r, 'end'));
    cols.forEach((c, j) => {
      const v = values[i][j], x = M.l + j * cw, y = M.t + i * ch;
      const t = v == null ? 0 : (v - lo) / (hi - lo || 1);
      const cell = s('rect', { x: x + 1, y: y + 1, width: cw - 2, height: ch - 2, rx: 2, fill: 'var(--accent)', 'fill-opacity': v == null ? 0.05 : 0.12 + 0.88 * t });
      cell.addEventListener('pointermove', (e) => showTip(e, [h('b', null, `${r} · ${c}`), h('div', null, v == null ? '데이터 없음' : format(v))]));
      cell.addEventListener('pointerleave', hideTip);
      svg.append(cell, v == null ? null : s('text', { x: x + cw / 2, y: y + ch / 2 + 4, 'text-anchor': 'middle', style: 'fill:var(--text);font-size:12px;pointer-events:none' }, format(v)));
    });
  });
  box.append(svg);
  return box;
}
