// 타이어 컴파운드 표기(라이브·스틴트 공용): [약자, 색, 한글 이름]
export const TYRE = {
  SOFT: ['S', '#e10600', '소프트'], MEDIUM: ['M', '#f5c400', '미디엄'], HARD: ['H', '#e5e5e5', '하드'],
  INTERMEDIATE: ['I', '#2bb24c', '인터미디엇'], WET: ['W', '#2f7de1', '웨트'],
};
export const tyreInfo = (c) => TYRE[c] ?? ['?', '#888', '알 수 없음'];
