// DOM 도우미: 문자열은 항상 텍스트 노드로 들어가므로 외부 데이터를 넣어도 안전하다(innerHTML 미사용).
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  applyProps(el, props);
  el.append(...kids.flat().filter((k) => k != null && k !== false));
  return el;
}

export function s(tag, props, ...kids) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  applyProps(el, props);
  el.append(...kids.flat().filter((k) => k != null && k !== false));
  return el;
}

function applyProps(el, props) {
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
}

export function mount(container, ...nodes) {
  container.replaceChildren(...nodes);
}
