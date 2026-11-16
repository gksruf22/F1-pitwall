// 일정 페이지: 시즌 캘린더(KST 세션 시각), 완료된 레이스는 결과로 연결.
import { h } from '../dom.js';
import { api, urlParam } from '../api.js';
import { mountLayout, sectionTabs } from '../layout.js';
import { load, emptyState } from '../ui.js';
import { kstDate, kstTime, kstShortDate, SESSION_NAMES } from '../format.js';

mountLayout('schedule');
const app = document.getElementById('app');
const head = h('div', { class: 'page-head' }, h('h1', null, '일정·결과·순위'));
const body = h('div');
app.append(head, sectionTabs('schedule'), body);

load(body, () => api('/races', { season: urlParam('season') }), ({ season, races }) => {
  if (!races.length) return emptyState('이 시즌의 일정이 없습니다.');
  const nextId = races.find((r) => !r.finished)?.id;
  return h('div', { class: 'race-list' }, races.map((r) => {
    const sessions = r.sessions ?? [];
    const raceStart = sessions.find((x) => x.type === 'R')?.startUtc;
    const isNext = r.id === nextId;
    return h('article', { class: `card race${isNext ? ' next' : ''}` },
      h('div', { class: 'round num' }, String(r.round).padStart(2, '0')),
      h('div', null,
        h('div', { class: 'title' }, r.name, ' ', isNext && h('span', { class: 'chip accent' }, '다음'),
          sessions.some((x) => x.type === 'S') && h('span', { class: 'chip' }, '스프린트')),
        h('div', { class: 'muted' }, [r.circuit_name, r.country].filter(Boolean).join(' · '),
          raceStart && ` · ${kstDate(raceStart)}`),
        h('div', { class: 'sessions' }, sessions.map((x) =>
          h('span', { class: `chip${x.type === 'R' ? ' accent' : ''}` },
            `${SESSION_NAMES[x.type]} ${kstShortDate(x.startUtc)} ${kstTime(x.startUtc)}`)))),
      h('div', { class: 'go' }, r.finished
        ? h('a', { class: 'btn', href: `/results.html?race=${r.id}&season=${season}` }, '결과 보기')
        : h('span', { class: 'muted' }, '예정')));
  }));
});
