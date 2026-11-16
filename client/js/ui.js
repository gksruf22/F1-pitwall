// 공통 UI 컴포넌트: 스켈레톤·오류·빈 상태·표·탭·변동 표시.
import { h, mount } from './dom.js';

export const skeleton = (rows = 5, height = 44) =>
  h('div', { class: 'stack', style: 'gap:8px', 'aria-busy': 'true', 'aria-label': '불러오는 중' },
    Array.from({ length: rows }, () => h('div', { class: 'skeleton', style: `height:${height}px` })));

export const emptyState = (message) => h('div', { class: 'state' }, h('p', null, message));

export const errorState = (message, retry) =>
  h('div', { class: 'state error', role: 'alert' },
    h('p', null, message),
    retry && h('button', { class: 'btn', onclick: retry }, '다시 시도'));

// 비동기 화면 공통 흐름: 로딩 스켈레톤 → 성공 시 render 결과 / 실패 시 오류 화면(다시 시도 버튼)
export async function load(container, task, render, skel = skeleton()) {
  mount(container, skel);
  try {
    const data = await task();
    mount(container, ...[].concat(render(data)).filter(Boolean));
  } catch (err) {
    mount(container, errorState(err.message, () => load(container, task, render, skel)));
  }
}

// columns: [{ label, render(row), align, class }]
export function table(columns, rows) {
  return h('div', { class: 'table-wrap' },
    h('table', null,
      h('thead', null, h('tr', null, columns.map((c) => h('th', { class: c.align === 'right' ? 'r' : '' }, c.label)))),
      h('tbody', null, rows.map((row) =>
        h('tr', null, columns.map((c) => h('td', { class: [c.align === 'right' ? 'r num' : '', c.class ?? ''].join(' ').trim() }, c.render(row))))))));
}

export const colorBar = (color) => h('span', { class: 'bar', style: `background:${color}` });

// 순위 변동(양수 = 상승)
export function change(n) {
  if (!n) return h('span', { class: 'muted' }, '–');
  return h('span', { class: n > 0 ? 'up' : 'down' }, `${n > 0 ? '▲' : '▼'}${Math.abs(n)}`);
}

// items: [{ key, label, href? }]
export function tabs(items, active, onSelect) {
  return h('nav', { class: 'tabs', 'aria-label': '탭' }, items.map((t) =>
    t.href
      ? h('a', { href: t.href, 'aria-current': t.key === active ? 'page' : null }, t.label)
      : h('button', { 'aria-current': t.key === active ? 'true' : 'false', onclick: () => onSelect(t.key) }, t.label)));
}
