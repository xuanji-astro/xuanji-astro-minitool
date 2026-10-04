// 小工具的 DOM 小帮手：不用 innerHTML 拼字符串（全部 textContent），事件一律 addEventListener（容器禁行内事件）
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  setAttrs(el, attrs);
  append(el, kids);
  return el;
}
const SVGNS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) { if (k === 'text') el.textContent = v; else el.setAttribute(k, v); }
  append(el, kids);
  return el;
}
function setAttrs(el, attrs) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
}
function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
  }
}

// 折叠块：标题一行，点开看依据（「?」＝点进去的解释）
export function fold(title, body, open = false) {
  const box = h('div', { class: 'fold' + (open ? ' open' : '') });
  const head = h('button', { class: 'fold-h', type: 'button', on: { click: () => box.classList.toggle('open') } }, h('span', { text: title }), h('i', { class: 'fold-i', 'aria-hidden': 'true' }));
  box.append(head, h('div', { class: 'fold-b' }, body));
  return box;
}

export function chips(options, value, onPick, cls = '') {
  const row = h('div', { class: 'chips ' + cls });
  for (const [v, label] of options) {
    const b = h('button', { type: 'button', class: 'chip' + (v === value ? ' on' : ''), text: label });
    b.addEventListener('click', () => { for (const x of row.children) x.classList.remove('on'); b.classList.add('on'); onPick(v); });
    row.appendChild(b);
  }
  return row;
}

export function select(options, value, onChange, placeholder) {
  const el = h('select', { class: 'sel' });
  if (placeholder) el.appendChild(h('option', { value: '', text: placeholder, disabled: true, selected: value == null || value === '' }));
  for (const o of options) {
    const [v, label] = Array.isArray(o) ? o : [o, o];
    el.appendChild(h('option', { value: String(v), text: String(label), selected: String(v) === String(value) }));
  }
  el.addEventListener('change', () => onChange(el.value));
  return el;
}

export const pad2 = (n) => String(n).padStart(2, '0');
