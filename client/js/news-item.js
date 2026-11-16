// 뉴스 한 줄(출처 · 제목 링크 · 날짜). 외부 링크는 새 탭 + noopener.
import { h } from './dom.js';
import { kstDate, kstTime } from './format.js';

export const newsItem = (n) => h('li', null, h('span', { class: 'chip' }, n.source),
  h('a', { href: n.url, target: '_blank', rel: 'noopener noreferrer' }, n.title),
  n.publishedUtc && h('span', { class: 'muted', style: 'margin-left:auto;white-space:nowrap' }, `${kstDate(n.publishedUtc)} ${kstTime(n.publishedUtc)}`));
