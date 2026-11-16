// OpenF1 drivers의 team_colour로 team.color를 채운다. 사용: npm run collect:colors [-- --session 11326]
// OpenF1 팀 이름과 Jolpica 팀 id가 달라 아래 표로 연결한다(2026 기준 11팀).
import { pool, query } from '../server/db.js';

const TEAM_IDS = {
  'McLaren': 'mclaren', 'Red Bull Racing': 'red_bull', 'Audi': 'audi', 'Alpine': 'alpine',
  'Cadillac': 'cadillac', 'Mercedes': 'mercedes', 'Aston Martin': 'aston_martin', 'Ferrari': 'ferrari',
  'Williams': 'williams', 'Racing Bulls': 'rb', 'Haas F1 Team': 'haas',
};
const arg = process.argv.indexOf('--session');
const sessionKey = arg > 0 ? process.argv[arg + 1] : '11326'; // 2026 실버스톤

const res = await fetch(`https://api.openf1.org/v1/drivers?session_key=${sessionKey}`);
if (!res.ok) throw new Error(`OpenF1 응답 오류 ${res.status}`);
const drivers = await res.json();

const colors = new Map(drivers.map((d) => [d.team_name, d.team_colour]));
for (const [name, hex] of colors) {
  const id = TEAM_IDS[name];
  if (!id) { console.warn(`매핑 없음: ${name} — TEAM_IDS에 추가하세요.`); continue; }
  const { rowCount } = await query('UPDATE team SET color = $1 WHERE id = $2', [`#${hex.toLowerCase()}`, id]);
  console.log(`${id} → #${hex.toLowerCase()} (${rowCount}행)`);
}
await pool.end();
