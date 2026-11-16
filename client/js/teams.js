// 팀 컬러. DB의 team.color는 2주차에 OpenF1로 채울 예정이라, 그 전까지는 팀 id별 임시 색을 쓴다.
const FALLBACK = {
  mercedes: '#27f4d2', ferrari: '#e8002d', red_bull: '#3671c6', mclaren: '#ff8000',
  alpine: '#ff87bc', aston_martin: '#229971', williams: '#64c4ff', haas: '#b6babd',
  rb: '#6692ff', audi: '#c0c0c0', cadillac: '#f5c542',
};

export function teamColor(id, color) {
  if (/^#[0-9a-f]{6}$/i.test(color ?? '')) return color;
  return FALLBACK[id] ?? '#888888';
}
