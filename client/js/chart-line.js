// 선 차트(SVG 직접 구현). series: [{ id, label, color, dashed?, values: number[] }], xLabels: string[]
// 범례 버튼으로 시리즈를 켜고 끄고, 마우스를 올리면 해당 x의 값을 툴팁으로 보여 준다.
import { h, s } from './dom.js';
import { points } from './format.js';

const W = 900, H = 380, M = { l: 44, r: 16, t: 12, b: 28 };

export function lineChart({ series, xLabels, visible }) {
  const on = new Set(visible ?? series.map((x) => x.id));
  const box = h('div', { class: 'chart' });
  const legend = h('div', { class: 'legend' });
  const holder = h('div');
  const tip = h('div', { class: 'tip', hidden: true });
  box.append(legend, holder, tip);

  function draw() {
    const shown = series.filter((x) => on.has(x.id));
    const max = Math.max(10, ...shown.flatMap((x) => x.values));
    const step = niceStep(max);
    const top = Math.ceil(max / step) * step;
    const n = xLabels.length;
    const X = (i) => M.l + (n === 1 ? 0 : (i * (W - M.l - M.r)) / (n - 1));
    const Y = (v) => M.t + (1 - v / top) * (H - M.t - M.b);

    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': '누적 포인트 추이 선 차트' });
    for (let v = 0; v <= top; v += step) {
      svg.append(s('line', { class: 'grid-line', x1: M.l, x2: W - M.r, y1: Y(v), y2: Y(v) }),
        s('text', { class: 'axis-label', x: M.l - 8, y: Y(v) + 4, 'text-anchor': 'end' }, String(v)));
    }
    const every = Math.ceil(n / 12);
    xLabels.forEach((label, i) => {
      if (i % every === 0 || i === n - 1) svg.append(s('text', { class: 'axis-label', x: X(i), y: H - 8, 'text-anchor': 'middle' }, label));
    });
    for (const x of shown) {
      svg.append(s('polyline', {
        class: 'line', stroke: x.color, 'stroke-dasharray': x.dashed ? '6 4' : null,
        points: x.values.map((v, i) => `${X(i)},${Y(v)}`).join(' '),
      }));
    }
    const guide = s('line', { class: 'grid-line', y1: M.t, y2: H - M.b, visibility: 'hidden', style: 'stroke:var(--muted)' });
    svg.append(guide);

    svg.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      const i = Math.min(n - 1, Math.max(0, Math.round(((px - M.l) / (W - M.l - M.r)) * (n - 1))));
      guide.setAttribute('x1', X(i)); guide.setAttribute('x2', X(i)); guide.setAttribute('visibility', 'visible');
      const rows = shown.map((x) => ({ x, v: x.values[i] })).sort((a, b) => b.v - a.v);
      tip.replaceChildren(h('b', null, xLabels[i]), ...rows.map(({ x, v }) =>
        h('div', null, h('span', { style: `color:${x.color}` }, '● '), `${x.label} ${points(v)}`)));
      tip.hidden = false;
      const br = box.getBoundingClientRect();
      const left = e.clientX - br.left + 14;
      tip.style.left = `${Math.min(left, br.width - tip.offsetWidth - 8)}px`;
      tip.style.top = `${e.clientY - br.top + 14}px`;
    });
    svg.addEventListener('pointerleave', () => { tip.hidden = true; guide.setAttribute('visibility', 'hidden'); });
    holder.replaceChildren(svg);
  }

  legend.append(...series.map((x) => {
    const btn = h('button', { 'aria-pressed': on.has(x.id) ? 'true' : 'false' }, h('i', { style: `background:${x.color}` }), x.label);
    btn.addEventListener('click', () => {
      if (on.has(x.id)) on.delete(x.id); else on.add(x.id);
      btn.setAttribute('aria-pressed', on.has(x.id) ? 'true' : 'false');
      draw();
    });
    return btn;
  }));
  draw();
  return box;
}

function niceStep(max) {
  const raw = max / 5;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * p).find((v) => v >= raw);
}
