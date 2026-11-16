// Jolpica 랩·피트스톱 → DB. 실행: npm run collect:laps -- --year 2026 [--round 5] [--refresh]
// 결승(R)만 대상. 레이스당 랩 ≈ 11페이지·피트 1페이지 호출, 원본은 data/raw에 캐시되어 중단 후 이어받기가 된다.
import { parseArgs } from 'node:util';
import { pool, query } from '../server/db.js';
import { getJolpicaAll, toMs } from './lib/jolpica.js';

const { values } = parseArgs({ options: { year: { type: 'string' }, round: { type: 'string' }, refresh: { type: 'boolean' } } });
const year = Number(values.year);
if (!year) { console.error('사용법: npm run collect:laps -- --year 2026 [--round 5] [--refresh]'); process.exit(1); }

const { rows: races } = await query(
  `SELECT ra.round, s.id AS session_id FROM race ra JOIN session s ON s.race_id = ra.id AND s.type = 'R'
    WHERE ra.season = $1 AND ($2::int IS NULL OR ra.round = $2)
      AND EXISTS (SELECT 1 FROM result r WHERE r.session_id = s.id) ORDER BY ra.round`,
  [year, values.round ? Number(values.round) : null],
);

const { rows: known } = await query('SELECT id FROM driver');
const driverIds = new Set(known.map((d) => d.id));

for (const { round, session_id: sid } of races) {
  const route = `${year}/${round}`;
  const laps = await getJolpicaAll(`${route}/laps`, 'Laps', { refresh: values.refresh });
  const pits = await getJolpicaAll(`${route}/pitstops`, 'PitStops', { refresh: values.refresh });
  if (!laps) { console.log(`R${round}: 랩 데이터 없음`); continue; }

  const L = laps.Laps.flatMap((l) => l.Timings.filter((t) => driverIds.has(t.driverId))
    .map((t) => ({ d: t.driverId, lap: Number(l.number), ms: toMs(t.time), pos: Number(t.position) })));
  const P = (pits?.PitStops ?? []).filter((p) => driverIds.has(p.driverId))
    .map((p) => ({ d: p.driverId, lap: Number(p.lap), ms: toMs(p.duration) }));

  // 시드니 DB 왕복(~200ms)을 줄이려고 레이스 1건을 쿼리 3번으로 처리한다.
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query('DELETE FROM lap WHERE session_id = $1', [sid]);
    await db.query('DELETE FROM pit_stop WHERE session_id = $1', [sid]);
    await db.query(
      `INSERT INTO lap (session_id, driver_id, lap, time_ms, position)
       SELECT $1, * FROM unnest($2::text[], $3::int[], $4::int[], $5::int[])
       ON CONFLICT DO NOTHING`,
      [sid, L.map((x) => x.d), L.map((x) => x.lap), L.map((x) => x.ms), L.map((x) => x.pos)],
    );
    await db.query(
      `INSERT INTO pit_stop (session_id, driver_id, lap, lane_ms)
       SELECT $1, * FROM unnest($2::text[], $3::int[], $4::int[]) ON CONFLICT DO NOTHING`,
      [sid, P.map((x) => x.d), P.map((x) => x.lap), P.map((x) => x.ms)],
    );
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  } finally {
    db.release();
  }
  console.log(`R${round}: 랩 ${L.length}행, 피트스톱 ${P.length}건`);
}
await pool.end();
