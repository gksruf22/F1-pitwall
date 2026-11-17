// 팀 컬러. 기본은 DB의 team.color(OpenF1 team_colour, `npm run collect:colors`)이고, 값이 없을 때만 아래 예비 색을 쓴다.
const FALLBACK = {
  mercedes: '#27f4d2', ferrari: '#e8002d', red_bull: '#3671c6', mclaren: '#ff8000',
  alpine: '#ff87bc', aston_martin: '#229971', williams: '#64c4ff', haas: '#b6babd',
  rb: '#6692ff', audi: '#c0c0c0', cadillac: '#f5c542',
  // 과거 시즌(2010~2024) 팀. OpenF1 팀 컬러는 최근 시즌만 있어 직접 정한 근사 색이다(공식 색 아님).
  renault: '#ffd800', lotus_f1: '#1f1f1f', lotus_racing: '#0b6e4f', toro_rosso: '#2b4562', alphatauri: '#4e7c99',
  force_india: '#f596c8', racing_point: '#f596c8', sauber: '#9b0000', alfa: '#a42134', caterham: '#005030',
  marussia: '#6e0000', manor: '#d3202f', hrt: '#a0a0a0', virgin: '#e1352d', brawn: '#c8e000', toyota: '#d8112a',
};

export function teamColor(id, color) {
  if (/^#[0-9a-f]{6}$/i.test(color ?? '')) return color;
  return FALLBACK[id] ?? '#888888';
}
