// 뉴스: 공개 RSS 헤드라인(출처·날짜)을 보여주고 클릭하면 원문 사이트로 이동한다. 본문은 가져오지 않는다.
import { h } from '../dom.js';
import { api, urlParam, setUrlParams } from '../api.js';
import { mountLayout } from '../layout.js';
import { load, emptyState } from '../ui.js';
import { newsItem } from '../news-item.js';

mountLayout('news');
const page = Number(urlParam('page')) || 1;
const body = h('div');
document.getElementById('app').append(h('div', { class: 'page-head' }, h('div', null, h('h1', null, '뉴스'), h('div', { class: 'sub' }, '헤드라인과 링크만 제공합니다. 기사 본문은 각 출처 사이트에서 확인하세요.'))), body);

load(body, () => api('/news', { page, limit: 15 }), (d) => !d.items.length ? emptyState('저장된 뉴스가 없습니다.') : [
  h('ul', { class: 'feed' }, d.items.map(newsItem)),
  h('div', { class: 'pager' },
    h('button', { class: 'btn', disabled: page <= 1, onclick: () => setUrlParams({ page: page - 1 }) }, '이전'),
    h('span', { class: 'muted num' }, `${d.page} / ${d.pages}`),
    h('button', { class: 'btn', disabled: page >= d.pages, onclick: () => setUrlParams({ page: page + 1 }) }, '다음')),
]);
