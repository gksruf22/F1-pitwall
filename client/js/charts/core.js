// 차트 공통 기반: 눈금·스케일·축·툴팁을 한 곳에 두고 모든 차트(막대·박스플롯·점·도넛·히트맵·버블)가 재사용한다.
import { h, s } from '../dom.js';

export const W = 900; // viewBox 너비. 높이는 차트마다 계산하고, 화면 폭에 맞춰 비율로 줄어든다.

// 값 범위에 맞는 "보기 좋은" 눈금 배열
export function niceTicks(min, max, count = 5) {
  const span = max - min || 1;
  const raw = span / count;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * p).find((v) => v >= raw);
  const ticks = [];
  for (let v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step + 1e-9; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}

export const linear = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);

export const svgRoot = (height, label) => s('svg', { viewBox: `0 0 ${W} ${height}`, role: 'img', 'aria-label': label });

// 차트 상자 + 툴팁. showTip(이벤트, 노드들) / hideTip()
export function chartBox() {
  const box = h('div', { class: 'chart' });
  const tip = h('div', { class: 'tip', hidden: true });
  const showTip = (e, nodes) => {
    tip.replaceChildren(...nodes);
    tip.hidden = false;
    const r = box.getBoundingClientRect();
    tip.style.left = `${Math.max(4, Math.min(e.clientX - r.left + 14, r.width - tip.offsetWidth - 8))}px`;
    tip.style.top = `${e.clientY - r.top + 14}px`;
  };
  const hideTip = () => { tip.hidden = true; };
  box.append(tip);
  return { box, showTip, hideTip };
}

// 세로 눈금선 + 아래쪽 숫자 (값 축이 가로일 때)
export function xAxis(svg, ticks, X, top, bottom, fmt = String) {
  for (const v of ticks) {
    svg.append(s('line', { class: 'grid-line', x1: X(v), x2: X(v), y1: top, y2: bottom }),
      s('text', { class: 'axis-label', x: X(v), y: bottom + 16, 'text-anchor': 'middle' }, fmt(v)));
  }
}

// 가로 눈금선 + 왼쪽 숫자 (값 축이 세로일 때)
export function yAxis(svg, ticks, Y, left, right, fmt = String) {
  for (const v of ticks) {
    svg.append(s('line', { class: 'grid-line', x1: left, x2: right, y1: Y(v), y2: Y(v) }),
      s('text', { class: 'axis-label', x: left - 8, y: Y(v) + 4, 'text-anchor': 'end' }, fmt(v)));
  }
}

export const label = (x, y, text, anchor = 'start') =>
  s('text', { class: 'axis-label', x, y, 'text-anchor': anchor }, text);

// 사분위수(선형 보간). values는 정렬되어 있어야 한다.
export function quantile(sorted, p) {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
}
