// 선 차트(SVG 직접 구현). series: [{ id, label, color, dashed?, values: number[] }], xLabels: string[]
// 범례 버튼으로 시리즈를 켜고 끄고, 마우스를 올리면 해당 x의 값을 툴팁으로 보여 준다.
// 옵션: format(값 표기), title(접근성 설명), auto(0 대신 데이터 범위에 맞춘 축), invert(작은 값이 위: 순위·갭),
// asc(툴팁을 작은 값부터, 기본은 invert와 같음). values의 null은 선을 끊는다.
import { h, s } from './dom.js';
import { points } from './format.js';
import { niceTicks } from './charts/core.js';

const W = 900, H = 380;

export function lineChart({ series, xLabels, visible, format = points, title = '누적 포인트 추이 선 차트', auto = false, invert = false, asc = invert, left = 44 }) {
  const M = { l: left, r: 16, t: 12, b: 28 };
  const on = new Set(visible ?? series.map((x) => x.id));
  const box = h('div', { class: 'chart' });
  const legend = h('div', { class: 'legend' });
  const holder = h('div');
  const tip = h('div', { class: 'tip', hidden: true });
  box.append(legend, holder, tip);

  function draw() {
    const shown = series.filter((x) => on.has(x.id));
    const vals = shown.flatMap((x) => x.values).filter((v) => v != null);
    let ticks;
    if (auto || invert) ticks = niceTicks(Math.min(...vals, Infinity) === Infinity ? 0 : Math.min(...vals), Math.max(...vals, 1), 5);
    else {
      const max = Math.max(10, ...vals);
      const step = niceStep(max);
      ticks = [];
      for (let v = 0; v <= Math.ceil(max / step) * step; v += step) ticks.push(v);
    }
    const lo = ticks[0], hi = ticks.at(-1);
    const n = xLabels.length;
    const X = (i) => M.l + (n === 1 ? 0 : (i * (W - M.l - M.r)) / (n - 1));
    const frac = (v) => (v - lo) / (hi - lo || 1);
    const Y = (v) => M.t + (invert ? frac(v) : 1 - frac(v)) * (H - M.t - M.b);

    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': title });
    for (const v of ticks) {
      svg.append(s('line', { class: 'grid-line', x1: M.l, x2: W - M.r, y1: Y(v), y2: Y(v) }),
        s('text', { class: 'axis-label', x: M.l - 8, y: Y(v) + 4, 'text-anchor': 'end' }, format(v)));
    }
    const every = Math.ceil(n / 12);
    xLabels.forEach((label, i) => {
      if (i % every === 0 || i === n - 1) svg.append(s('text', { class: 'axis-label', x: X(i), y: H - 8, 'text-anchor': 'middle' }, label));
    });
    for (const x of shown) {
      // null(결측)에서 선을 끊고, 홀로 남은 점은 작은 원으로 그린다.
      let seg = [];
      const flush = () => {
        if (seg.length > 1) svg.append(s('polyline', { class: 'line', stroke: x.color, 'stroke-dasharray': x.dashed ? '6 4' : null, points: seg.join(' ') }));
        else if (seg.length) svg.append(s('circle', { cx: seg[0].split(',')[0], cy: seg[0].split(',')[1], r: 2, fill: x.color }));
        seg = [];
      };
      x.values.forEach((v, i) => (v == null ? flush() : seg.push(`${X(i)},${Y(v)}`)));
      flush();
    }
    const guide = s('line', { class: 'grid-line', y1: M.t, y2: H - M.b, visibility: 'hidden', style: 'stroke:var(--muted)' });
    svg.append(guide);

    svg.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      const i = Math.min(n - 1, Math.max(0, Math.round(((px - M.l) / (W - M.l - M.r)) * (n - 1))));
      guide.setAttribute('x1', X(i)); guide.setAttribute('x2', X(i)); guide.setAttribute('visibility', 'visible');
      const rows = shown.map((x) => ({ x, v: x.values[i] })).filter((r) => r.v != null).sort((a, b) => (asc ? a.v - b.v : b.v - a.v));
      tip.replaceChildren(h('b', null, xLabels[i]), ...rows.map(({ x, v }) =>
        h('div', null, h('span', { style: `color:${x.color}` }, '● '), `${x.label} ${format(v)}`)));
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
