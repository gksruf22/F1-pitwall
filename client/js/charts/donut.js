// 도넛 차트. slices: [{ label, value, color }]. center: { value, label } 가운데 문구. 범례는 아래에 둔다.
import { s, h } from '../dom.js';
import { chartBox } from './core.js';

export function donut({ slices, center, format = String, title = '도넛 차트' }) {
  const { box, showTip, hideTip } = chartBox();
  const total = slices.reduce((a, d) => a + d.value, 0) || 1;
  const R = 70, C = 2 * Math.PI * R;
  const svg = s('svg', { viewBox: '0 0 200 200', role: 'img', 'aria-label': title, style: 'max-width:260px;margin:0 auto' });
  let offset = 0;
  // 조각마다 원 하나에 stroke-dasharray를 써서 100%·0%인 경우에도 깨지지 않게 한다.
  for (const d of slices) {
    const len = (d.value / total) * C;
    const arc = s('circle', {
      cx: 100, cy: 100, r: R, fill: 'none', stroke: d.color, 'stroke-width': 28,
      'stroke-dasharray': `${len} ${C - len}`, 'stroke-dashoffset': -offset, transform: 'rotate(-90 100 100)',
    });
    arc.addEventListener('pointermove', (e) => showTip(e, [h('b', null, d.label), h('div', null, `${format(d.value)} (${Math.round((d.value / total) * 100)}%)`)]));
    arc.addEventListener('pointerleave', hideTip);
    svg.append(arc);
    offset += len;
  }
  if (center) {
    svg.append(
      s('text', { x: 100, y: 102, 'text-anchor': 'middle', style: 'fill:var(--text);font-size:30px;font-weight:900' }, center.value),
      s('text', { x: 100, y: 122, 'text-anchor': 'middle', class: 'axis-label' }, center.label ?? ''));
  }
  box.append(svg, h('div', { class: 'legend', style: 'justify-content:center;margin:12px 0 0' },
    slices.map((d) => h('span', { class: 'chip' }, h('i', { style: `background:${d.color};display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px` }), `${d.label} ${format(d.value)}`))));
  return box;
}
