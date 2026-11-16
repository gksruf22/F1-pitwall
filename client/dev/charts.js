// 공통 차트 모듈 미리보기(개발용). 아래 값은 모양을 보기 위한 샘플이며 실제 F1 데이터가 아니다.
import { h } from '/js/dom.js';
import { mountLayout } from '/js/layout.js';
import { lineChart } from '/js/chart-line.js';
import { barChart } from '/js/charts/bar.js';
import { boxPlot } from '/js/charts/box.js';
import { stripPlot } from '/js/charts/strip.js';
import { donut } from '/js/charts/donut.js';
import { heatmap } from '/js/charts/heatmap.js';
import { bubble } from '/js/charts/bubble.js';

mountLayout('');
const colors = ['#00d7b6', '#ed1131', '#4781d7', '#f47600', '#229971'];
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); // 고정 시드: 새로고침해도 같은 모양
const names = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE'];
const laps = (base) => Array.from({ length: 40 }, () => base + rnd() * 2 + (rnd() < 0.08 ? 4 : 0));
const lapFmt = (v) => `${Math.floor(v / 60)}:${(v % 60).toFixed(3).padStart(6, '0')}`.replace(/^0:/, '');
const sec = (v) => v.toFixed(1);

const section = (title, node) => h('section', null, h('div', { class: 'section-title' }, h('h2', null, title)), node);
document.getElementById('app').append(h('div', { class: 'stack' },
  h('div', { class: 'page-head' }, h('div', null, h('h1', null, '차트 미리보기'), h('div', { class: 'sub' }, '샘플 데이터 · 공통 차트 모듈 7종 확인용'))),
  section('선', lineChart({ series: names.map((n, i) => ({ id: n, label: n, color: colors[i], values: Array.from({ length: 12 }, (_, k) => Math.round((k + 1) * (30 - i * 4) + rnd() * 10)) })), xLabels: Array.from({ length: 12 }, (_, k) => `R${k + 1}`) })),
  section('가로 막대', barChart({ items: names.map((n, i) => ({ label: n, value: 20 - i * 3 + rnd() * 2, color: colors[i] })), format: sec })),
  h('div', { class: 'grid cols-2' },
    section('세로 막대', barChart({ items: names.map((n, i) => ({ label: n, value: 20 - i * 3 + rnd() * 2, color: colors[i] })), horizontal: false, format: sec })),
    section('도넛', donut({ slices: [{ label: '포인트 획득', value: 14, color: '#00d7b6' }, { label: '포인트 없음', value: 5, color: '#4781d7' }, { label: '리타이어', value: 1, color: '#ed1131' }], center: { value: '20', label: '레이스' } }))),
  section('박스플롯', boxPlot({ groups: names.map((n, i) => ({ label: n, color: colors[i], values: laps(90 + i * 0.4) })), format: lapFmt })),
  section('점 스트립/스웜', stripPlot({ groups: names.map((n, i) => ({ label: n, color: colors[i], values: laps(90 + i * 0.4) })), format: lapFmt })),
  section('버블', bubble({ points: names.map((n, i) => ({ label: n, x: 3 + rnd() * 5, y: 40 + rnd() * 40, r: 1 + rnd() * 9, color: colors[i] })), xLabel: '평균 속도', yLabel: '점수', format: sec })),
  section('히트맵', heatmap({ rows: names, cols: ['직선', '코너', '타이어', '연석', '고저차', '오버테이크', '안전카'], values: names.map(() => Array.from({ length: 7 }, () => 1 + Math.round(rnd() * 4))), min: 1, max: 5 }))));
