// Jolpica → DB 수집. 실행: npm run collect -- --year 2026 [--round 5] [--refresh]
// 일정·세션 시작 시각·결과(결승/스프린트/예선)를 저장한다. 순위표는 저장하지 않고 result에서 계산한다.
import { parseArgs } from 'node:util';
import { pool } from '../server/db.js';
import { getJolpica, toMs } from './lib/jolpica.js';

const { values } = parseArgs({
  options: { year: { type: 'string' }, round: { type: 'string' }, refresh: { type: 'boolean' } },
});
const year = Number(values.year);
if (!year) {
  console.error('사용법: npm run collect -- --year 2026 [--round 5] [--refresh]');
  process.exit(1);
}
const opt = { refresh: !!values.refresh };
const utc = (s) => (s?.date ? `${s.date}T${s.time ?? '00:00:00Z'}` : null);
const int = (v) => (v == null || v === '' ? null : Number(v));

// 세션 종류별 Jolpica 경로·결과 키·시작 시각 키
const SESSIONS = [
  { type: 'R', route: 'results', key: 'Results', start: (r) => utc({ date: r.date, time: r.time }) },
  { type: 'Q', route: 'qualifying', key: 'QualifyingResults', start: (r) => utc(r.Qualifying) },
  { type: 'S', route: 'sprint', key: 'SprintResults', start: (r) => utc(r.Sprint), only: (r) => r.Sprint },
];

// 시드니 리전이라 쿼리 왕복이 ~200ms → 행마다 보내지 않고 unnest로 한 번에 넣는다.
async function upsertPeople(db, list) {
  const drivers = [...new Map(list.map((e) => [e.Driver.driverId, e.Driver])).values()];
  const teams = [...new Map(list.map((e) => [e.Constructor.constructorId, e.Constructor])).values()];
  const entries = [...new Map(list.map((e) => [e.Driver.driverId + e.Constructor.constructorId, e])).values()];
  await db.query(
    `INSERT INTO driver (id, code, name, nationality, birth)
     SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::date[])
     ON CONFLICT (id) DO UPDATE SET code=EXCLUDED.code, name=EXCLUDED.name,
       nationality=EXCLUDED.nationality, birth=EXCLUDED.birth`,
    [
      drivers.map((d) => d.driverId), drivers.map((d) => d.code ?? null),
      drivers.map((d) => `${d.givenName} ${d.familyName}`), drivers.map((d) => d.nationality),
      drivers.map((d) => d.dateOfBirth ?? null),
    ],
  );
  await db.query(
    `INSERT INTO team (id, name) SELECT * FROM unnest($1::text[], $2::text[])
     ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name`,
    [teams.map((t) => t.constructorId), teams.map((t) => t.name)],
  );
  await db.query(
    `INSERT INTO entry (season, driver_id, team_id, number)
     SELECT $1, * FROM unnest($2::text[], $3::text[], $4::int[])
     ON CONFLICT (season, driver_id, team_id) DO UPDATE SET number=EXCLUDED.number`,
    [year, entries.map((e) => e.Driver.driverId), entries.map((e) => e.Constructor.constructorId),
      entries.map((e) => int(e.number))],
  );
}

async function upsertRace(db, r) {
  const ci = r.Circuit;
  const loc = ci.Location ?? {};
  await db.query(
    `INSERT INTO circuit (id, name, country, lat, lon) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (id) DO UPDATE SET name=$2, country=$3, lat=$4, lon=$5`,
    [ci.circuitId, ci.circuitName, loc.country ?? null, int(loc.lat), int(loc.long)],
  );
  const { rows } = await db.query(
    `INSERT INTO race (season, round, name, circuit_id) VALUES ($1,$2,$3,$4)
     ON CONFLICT (season, round) DO UPDATE SET name=$3, circuit_id=$4 RETURNING id`,
    [year, Number(r.round), r.raceName, ci.circuitId],
  );
  const raceId = rows[0].id;
  // 세션 시작 시각(결과 유무와 무관하게 일정 단계에서 저장). 스프린트 예선은 Jolpica 결과가 없어 시각만 저장.
  const starts = [
    ['R', utc({ date: r.date, time: r.time })],
    ['Q', utc(r.Qualifying)],
    ['S', utc(r.Sprint)],
    ['SQ', utc(r.SprintQualifying ?? r.SprintShootout)],
  ];
  for (const [type, start] of starts) {
    if (!start) continue;
    await db.query(
      `INSERT INTO session (race_id, type, start_utc) VALUES ($1,$2,$3)
       ON CONFLICT (race_id, type) DO UPDATE SET start_utc=$3`,
      [raceId, type, start],
    );
  }
  return raceId;
}

async function ingestResults(db, raceId, round, s) {
  const data = await getJolpica(`${year}/${round}/${s.route}`, opt);
  const list = data.RaceTable.Races[0]?.[s.key];
  if (!list) return 0; // 아직 열리지 않은 세션
  const { rows } = await db.query('SELECT id FROM session WHERE race_id=$1 AND type=$2', [raceId, s.type]);
  const sessionId = rows[0].id;
  await upsertPeople(db, list);
  const col = (f) => list.map(f);
  await db.query(
    `INSERT INTO result (session_id, driver_id, team_id, grid, position, points, status,
                         fastest_lap_ms, fastest_rank, q1_ms, q2_ms, q3_ms)
     SELECT $1, * FROM unnest($2::text[], $3::text[], $4::int[], $5::int[], $6::numeric[], $7::text[],
                              $8::int[], $9::smallint[], $10::int[], $11::int[], $12::int[])
     ON CONFLICT (session_id, driver_id) DO UPDATE SET team_id=EXCLUDED.team_id, grid=EXCLUDED.grid,
       position=EXCLUDED.position, points=EXCLUDED.points, status=EXCLUDED.status,
       fastest_lap_ms=EXCLUDED.fastest_lap_ms, fastest_rank=EXCLUDED.fastest_rank,
       q1_ms=EXCLUDED.q1_ms, q2_ms=EXCLUDED.q2_ms, q3_ms=EXCLUDED.q3_ms`,
    [
      sessionId, col((e) => e.Driver.driverId), col((e) => e.Constructor.constructorId),
      col((e) => int(e.grid)), col((e) => int(e.position)), col((e) => Number(e.points ?? 0)),
      col((e) => e.status ?? null), col((e) => toMs(e.FastestLap?.Time?.time)),
      col((e) => int(e.FastestLap?.rank)), col((e) => toMs(e.Q1)), col((e) => toMs(e.Q2)),
      col((e) => toMs(e.Q3)),
    ],
  );
  return list.length;
}

try {
  await pool.query('INSERT INTO season (year) VALUES ($1) ON CONFLICT DO NOTHING', [year]);
  const schedule = await getJolpica(`${year}`, opt);
  let races = schedule.RaceTable.Races;
  if (values.round) races = races.filter((r) => r.round === values.round);
  console.log(`${year} 시즌 ${races.length}라운드 수집`);

  for (const r of races) {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      const raceId = await upsertRace(db, r);
      const counts = [];
      for (const s of SESSIONS) {
        if (s.only && !s.only(r)) continue;
        counts.push(`${s.type} ${await ingestResults(db, raceId, r.round, s)}`);
      }
      await db.query('COMMIT');
      console.log(`R${r.round} ${r.raceName} — 결과 행: ${counts.join(', ')}`);
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    } finally {
      db.release();
    }
  }
} catch (e) {
  console.error('수집 실패:', e.message);
  process.exitCode = e.rateLimited ? 75 : 1; // 75 = 호출 한도(내일 이어서 실행)
} finally {
  await pool.end();
}
