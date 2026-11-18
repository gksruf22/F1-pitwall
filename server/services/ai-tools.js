// AI가 호출할 수 있는 읽기 전용 조회 함수. 숫자는 전부 여기(DB)에서 나오고 AI는 만들지 않는다.
// declarations는 Gemini functionDeclarations 형식, run()은 이름으로 실행해 결과(최대 MAX_ROWS행)를 돌려준다.
import { query } from '../db.js';
import { getStandings } from './standings.js';

export const MAX_ROWS = 50;

const season = { type: 'integer', description: '시즌 연도 (예: 2025)' };
const round = { type: 'integer', description: '라운드 번호. 모르면 get_races로 먼저 찾는다' };
const driver = { type: 'string', description: '드라이버 영문 이름 일부, 3글자 코드(VER) 또는 id' };

export const declarations = [
  {
    name: 'get_races',
    description: '시즌의 그랑프리 목록(라운드·이름·서킷·국가·결과 유무). 레이스 이름으로 라운드를 찾을 때 쓴다.',
    parameters: { type: 'object', properties: { season }, required: ['season'] },
  },
  {
    name: 'get_race_results',
    description: '그랑프리 한 세션의 결과(순위·그리드·포인트·상태·패스티스트 랩·예선 기록). 시간 값은 밀리초.',
    parameters: {
      type: 'object',
      properties: {
        season, round,
        session: { type: 'string', enum: ['R', 'Q', 'S', 'SQ'], description: 'R=결승(기본), Q=예선, S=스프린트, SQ=스프린트 예선' },
      },
      required: ['season', 'round'],
    },
  },
  {
    name: 'get_standings',
    description: '드라이버 또는 컨스트럭터 챔피언십 순위(포인트·우승 수·선두와의 격차). round를 주면 그 라운드 직후 순위.',
    parameters: {
      type: 'object',
      properties: { season, kind: { type: 'string', enum: ['driver', 'constructor'] }, round },
      required: ['season', 'kind'],
    },
  },
  {
    name: 'get_driver_laps',
    description: '한 드라이버의 결승 랩별 기록(랩타임 ms·순위·피트아웃 여부, 일부 레이스는 섹터·스피드트랩)과 요약(최고·평균, 평균은 피트·세이프티카 랩을 포함한 전체 평균이므로 답할 때 그렇게 밝힌다). 한 번에 최대 50랩이므로 필요하면 lap_from/lap_to로 나눈다.',
    parameters: {
      type: 'object',
      properties: { season, round, driver, lap_from: { type: 'integer' }, lap_to: { type: 'integer' } },
      required: ['season', 'round', 'driver'],
    },
  },
  {
    name: 'get_pit_stops',
    description: '결승 피트스톱 목록(랩, 피트레인 통과 시간 lane_ms, 일부 레이스는 정지 시간 stop_ms). 통과 시간이 짧은 순.',
    parameters: { type: 'object', properties: { season, round, driver }, required: ['season', 'round'] },
  },
];

class ToolError extends Error {}

async function raceId(s, r) {
  const { rows } = await query('SELECT id, name FROM race WHERE season = $1 AND round = $2', [s, r]);
  if (!rows[0]) throw new ToolError(`${s}시즌 ${r}라운드 레이스가 없습니다.`);
  return rows[0];
}

async function driverId(text) {
  const { rows } = await query(
    `SELECT id, name FROM driver
      WHERE id = lower($1) OR upper(code) = upper($1) OR name ILIKE '%' || $1 || '%'
      ORDER BY (id = lower($1)) DESC, (upper(code) = upper($1)) DESC LIMIT 2`,
    [String(text).trim()],
  );
  if (!rows[0]) throw new ToolError(`드라이버 "${text}"를 찾을 수 없습니다.`);
  return rows[0];
}

const handlers = {
  async get_races({ season: s }) {
    const { rows } = await query(
      `SELECT ra.round, ra.name, c.name AS circuit, c.country,
              EXISTS (SELECT 1 FROM session x JOIN result r ON r.session_id = x.id
                       WHERE x.race_id = ra.id AND x.type = 'R') AS finished
         FROM race ra LEFT JOIN circuit c ON c.id = ra.circuit_id
        WHERE ra.season = $1 ORDER BY ra.round`,
      [s],
    );
    return { season: s, races: rows };
  },

  async get_race_results({ season: s, round: r, session = 'R' }) {
    const race = await raceId(s, r);
    const { rows } = await query(
      `SELECT r.position, d.name AS driver, d.code, t.name AS team, r.grid, r.points::float AS points, r.status,
              r.fastest_lap_ms, r.fastest_rank, r.q1_ms, r.q2_ms, r.q3_ms
         FROM result r JOIN session s ON s.id = r.session_id
         JOIN driver d ON d.id = r.driver_id LEFT JOIN team t ON t.id = r.team_id
        WHERE s.race_id = $1 AND s.type = $2
        ORDER BY r.position NULLS LAST, d.name LIMIT ${MAX_ROWS}`,
      [race.id, session],
    );
    // 해당 세션에 쓰이지 않는 열(null)은 빼서 토큰을 아낀다
    const results = rows.map((row) => Object.fromEntries(Object.entries(row).filter(([, v]) => v != null)));
    return { race: race.name, season: s, round: r, session, results };
  },

  async get_standings({ season: s, kind, round: r }) {
    const d = await getStandings(s, kind === 'constructor' ? 'constructor' : 'driver', r);
    return {
      season: s, kind, afterRound: d.round,
      standings: d.standings.slice(0, MAX_ROWS).map((e) => ({
        position: e.position, name: e.name, team: e.teamName, points: e.points, wins: e.wins, gapToLeader: e.gapToLeader,
      })),
    };
  },

  async get_driver_laps({ season: s, round: r, driver: name, lap_from: from = 1, lap_to: to }) {
    const race = await raceId(s, r);
    const drv = await driverId(name);
    const { rows } = await query(
      `SELECT l.lap, l.time_ms, l.position, l.pit_out, l.s1, l.s2, l.s3, l.st_speed
         FROM lap l JOIN session x ON x.id = l.session_id
        WHERE x.race_id = $1 AND x.type = 'R' AND l.driver_id = $2
        ORDER BY l.lap`,
      [race.id, drv.id],
    );
    if (!rows.length) return { race: race.name, driver: drv.name, laps: [], note: '이 레이스의 랩 데이터가 없습니다.' };
    const times = rows.map((l) => l.time_ms).filter(Boolean);
    const best = Math.min(...times);
    const picked = rows.filter((l) => l.lap >= from && (to == null || l.lap <= to)).slice(0, MAX_ROWS);
    return {
      race: race.name, driver: drv.name,
      summary: { laps: rows.length, best_ms: best, best_lap: rows.find((l) => l.time_ms === best).lap,
        avg_ms: Math.round(times.reduce((a, b) => a + b, 0) / times.length) },
      laps: picked.map((row) => Object.fromEntries(Object.entries(row).filter(([, v]) => v != null))),
      truncated: picked.length < rows.filter((l) => l.lap >= from && (to == null || l.lap <= to)).length,
    };
  },

  async get_pit_stops({ season: s, round: r, driver: name }) {
    const race = await raceId(s, r);
    const drv = name ? await driverId(name) : null;
    const { rows } = await query(
      `SELECT d.name AS driver, t.name AS team, p.lap, p.lane_ms, p.stop_ms
         FROM pit_stop p JOIN session x ON x.id = p.session_id
         JOIN driver d ON d.id = p.driver_id
         LEFT JOIN result res ON res.session_id = p.session_id AND res.driver_id = p.driver_id
         LEFT JOIN team t ON t.id = res.team_id
        WHERE x.race_id = $1 AND x.type = 'R' AND ($2::text IS NULL OR p.driver_id = $2)
        ORDER BY p.lane_ms NULLS LAST LIMIT ${MAX_ROWS}`,
      [race.id, drv?.id ?? null],
    );
    return {
      race: race.name, ...(drv && { driver: drv.name }),
      stops: rows.map((row) => Object.fromEntries(Object.entries(row).filter(([, v]) => v != null))),
      ...(!rows.length && { note: '이 레이스의 피트스톱 데이터가 없습니다.' }),
    };
  },
};

// 실행 결과. 잘못된 이름·인자는 오류 메시지를 결과로 돌려 AI가 고쳐 다시 묻게 한다.
export async function runTool(name, args = {}) {
  const fn = handlers[name];
  if (!fn) return { error: `알 수 없는 도구: ${name}` };
  for (const k of ['season', 'round', 'lap_from', 'lap_to']) {
    if (args[k] != null && !Number.isInteger(Number(args[k]))) return { error: `${k} 값이 정수가 아닙니다.` };
    if (args[k] != null) args[k] = Number(args[k]);
  }
  try {
    return await fn(args);
  } catch (e) {
    if (e instanceof ToolError) return { error: e.message };
    throw e;
  }
}
