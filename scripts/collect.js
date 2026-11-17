// OpenF1 → DB·파일. 실행: npm run collect:openf1 [-- --round 9] [--skip-location]
// 인자가 없으면 결과가 있는 2026 레이스 중 위치 데이터가 있고 아직 수집하지 않은 레이스를 모두 순서대로 받는다.
// 스틴트·섹터·스피드트랩·정지 시간·레이스 컨트롤 이벤트·순위 변경·위치(리플레이)·트랙 윤곽을 저장한다.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { pool, query } from '../server/db.js';
import { openf1 } from './lib/openf1.js';

const { values } = parseArgs({ options: { round: { type: 'string' }, 'skip-location': { type: 'boolean' } } });
const SEASON = 2026;
// 레이스 목록: DB의 결승 시작일과 OpenF1 세션 날짜를 맞춰 session_key를 찾는다.
async function findRaces() {
  const sessions = await openf1('sessions', { year: SEASON, session_name: 'Race' });
  const { rows } = await query(
    `SELECT ra.round, s.start_utc, s.openf1_key FROM race ra JOIN session s ON s.race_id = ra.id AND s.type = 'R'
      WHERE ra.season = $1 AND EXISTS (SELECT 1 FROM result r WHERE r.session_id = s.id) ORDER BY ra.round`, [SEASON]);
  return rows.map((r) => ({ round: r.round, done: r.openf1_key != null,
    key: sessions.find((x) => x.date_start.slice(0, 10) === r.start_utc.toISOString().slice(0, 10))?.session_key }))
    .filter((r) => r.key && (!values.round || r.round === Number(values.round)));
}
const ms = (sec) => (sec == null ? null : Math.round(sec * 1000));
const REPLAY_DIR = fileURLToPath(new URL('../data/replay/', import.meta.url));

async function collectRace({ round, key }) {
  console.log(`\n== R${round} (session ${key}) ==`);
  const { rows: [sess] } = await query(
    `SELECT s.id FROM session s JOIN race ra ON ra.id = s.race_id WHERE ra.season = $1 AND ra.round = $2 AND s.type = 'R'`, [SEASON, round]);
  if (!sess) throw new Error(`R${round} 세션이 DB에 없습니다. 먼저 npm run collect 를 실행하세요.`);
  const sid = sess.id;
  const [info] = await openf1('sessions', { session_key: key });
  const { rows: drv } = await query('SELECT id, code FROM driver');
  const byCode = new Map(drv.map((d) => [d.code, d.id]));
  const nums = new Map((await openf1('drivers', { session_key: key })).map((d) => [d.driver_number, { id: byCode.get(d.name_acronym), code: d.name_acronym }]));
  const idOf = (n) => nums.get(n)?.id;
  console.log(`드라이버 ${[...nums.values()].filter((d) => d.id).length}/${nums.size} 매핑`);

  // 위치 데이터가 없는 레이스(예: 모나코)는 리플레이가 불가능하므로 받지 않는다.
  if (!values['skip-location']) {
    const probeFrom = new Date(+new Date(info.date_start) + 20 * 60000).toISOString().slice(0, 19);
    const probeTo = new Date(+new Date(info.date_start) + 22 * 60000).toISOString().slice(0, 19);
    if (!(await openf1('location', { session_key: key, driver_number: 1 }, `&date%3E${probeFrom}&date%3C${probeTo}`)).length) {
      console.log('위치 데이터가 없어 건너뜁니다.');
      return;
    }
  }

  // 1) 스틴트
  const stints = (await openf1('stints', { session_key: key })).filter((s) => idOf(s.driver_number));
  await query('DELETE FROM stint WHERE session_id = $1', [sid]);
  await query(
    `INSERT INTO stint (session_id, driver_id, no, lap_from, lap_to, compound)
     SELECT $1, * FROM unnest($2::text[], $3::int[], $4::int[], $5::int[], $6::text[])`,
    [sid, stints.map((s) => idOf(s.driver_number)), stints.map((s) => s.stint_number), stints.map((s) => s.lap_start), stints.map((s) => s.lap_end), stints.map((s) => s.compound)]);
  console.log(`스틴트 ${stints.length}건`);

  // 2) 랩: 섹터·스피드트랩·피트아웃 (랩타임·순위는 Jolpica 값 유지)
  const laps = (await openf1('laps', { session_key: key })).filter((l) => idOf(l.driver_number) && l.lap_number);
  const { rowCount } = await query(
    `UPDATE lap SET s1 = v.s1, s2 = v.s2, s3 = v.s3, st_speed = v.st, pit_out = v.po
       FROM unnest($2::text[], $3::int[], $4::int[], $5::int[], $6::int[], $7::int[], $8::bool[]) AS v(d, n, s1, s2, s3, st, po)
      WHERE lap.session_id = $1 AND lap.driver_id = v.d AND lap.lap = v.n`,
    [sid, laps.map((l) => idOf(l.driver_number)), laps.map((l) => l.lap_number), laps.map((l) => ms(l.duration_sector_1)),
      laps.map((l) => ms(l.duration_sector_2)), laps.map((l) => ms(l.duration_sector_3)), laps.map((l) => l.st_speed ?? null), laps.map((l) => !!l.is_pit_out_lap)]);
  console.log(`랩 ${laps.length}건 중 ${rowCount}건 갱신`);

  // 3) 피트스톱: OpenF1 정지 시간(stop_ms). 피트레인 통과 시간(lane_ms)은 Jolpica 값을 우선한다.
  const pits = (await openf1('pit', { session_key: key })).filter((p) => idOf(p.driver_number) && p.lap_number);
  await query(
    `INSERT INTO pit_stop (session_id, driver_id, lap, lane_ms, stop_ms)
     SELECT $1, * FROM unnest($2::text[], $3::int[], $4::int[], $5::int[])
     ON CONFLICT (session_id, driver_id, lap) DO UPDATE
       SET stop_ms = EXCLUDED.stop_ms, lane_ms = COALESCE(pit_stop.lane_ms, EXCLUDED.lane_ms)`,
    [sid, pits.map((p) => idOf(p.driver_number)), pits.map((p) => p.lap_number), pits.map((p) => ms(p.lane_duration)), pits.map((p) => ms(p.stop_duration))]);
  console.log(`피트스톱 ${pits.length}건 (정지 시간)`);

  // 4) 이벤트 (공통 이벤트 모델: GREEN_FLAG | SAFETY_CAR | RED_FLAG | PIT_IN | PIT_OUT | FASTEST_LAP | POSITION_CHANGE)
  const ev = [];
  const push = (ts, lap, type, driver, data) => ev.push({ ts, lap, type, driver, data });
  for (const r of await openf1('race_control', { session_key: key })) {
    if (r.category === 'SafetyCar') {
      push(r.date, r.lap_number, 'SAFETY_CAR', null, { kind: /VSC|VIRTUAL/i.test(r.message) ? 'VSC' : 'SC', state: /ENDING/i.test(r.message) ? 'ENDING' : 'DEPLOYED', message: r.message });
    } else if (r.category === 'Flag' && r.flag === 'RED') push(r.date, r.lap_number, 'RED_FLAG', null, { message: r.message });
    else if (r.category === 'Flag' && r.flag === 'GREEN' && r.scope === 'Track') push(r.date, r.lap_number, 'GREEN_FLAG', null, { message: r.message });
  }
  for (const p of pits) {
    const code = nums.get(p.driver_number).code;
    push(p.date, p.lap_number, 'PIT_IN', code, { stopMs: ms(p.stop_duration) });
    push(new Date(+new Date(p.date) + (p.lane_duration ?? 0) * 1000).toISOString(), p.lap_number, 'PIT_OUT', code, {});
  }
  // 최속 랩 경신: 랩 종료 시각 순서로 보며 기록이 갱신될 때마다
  let best = Infinity;
  for (const l of laps.filter((x) => x.lap_duration && x.date_start && !x.is_pit_out_lap).sort((a, b) => (+new Date(a.date_start) + a.lap_duration * 1000) - (+new Date(b.date_start) + b.lap_duration * 1000))) {
    if (l.lap_duration < best) {
      best = l.lap_duration;
      push(new Date(+new Date(l.date_start) + l.lap_duration * 1000).toISOString(), l.lap_number, 'FASTEST_LAP', nums.get(l.driver_number).code, { ms: ms(l.lap_duration) });
    }
  }
  const start = new Date(info.date_start);
  for (const p of (await openf1('position', { session_key: key })).filter((x) => idOf(x.driver_number) && new Date(x.date) >= start)) {
    push(p.date, null, 'POSITION_CHANGE', nums.get(p.driver_number).code, { position: p.position });
  }
  ev.sort((a, b) => new Date(a.ts) - new Date(b.ts));
  await query('DELETE FROM replay_event WHERE session_id = $1', [sid]);
  await query(
    `INSERT INTO replay_event (session_id, seq, ts, lap, type, driver, data)
     SELECT $1, * FROM unnest($2::int[], $3::timestamptz[], $4::int[], $5::text[], $6::text[], $7::jsonb[])`,
    [sid, ev.map((_, i) => i + 1), ev.map((e) => e.ts), ev.map((e) => e.lap ?? null), ev.map((e) => e.type), ev.map((e) => e.driver), ev.map((e) => JSON.stringify(e.data))]);
  const counts = ev.reduce((a, e) => ({ ...a, [e.type]: (a[e.type] ?? 0) + 1 }), {});
  console.log('이벤트', JSON.stringify(counts));

  // 5) 트랙 윤곽: 가장 빠른 한 랩의 위치 궤적 (circuit.track_path)
  const fast = laps.filter((l) => l.lap_duration && !l.is_pit_out_lap && l.date_start).sort((a, b) => a.lap_duration - b.lap_duration)[0];
  if (fast) {
    const from = new Date(fast.date_start).toISOString().slice(0, 19), to = new Date(+new Date(fast.date_start) + fast.lap_duration * 1000).toISOString().slice(0, 19);
    const pts = await openf1('location', { session_key: key, driver_number: fast.driver_number }, `&date%3E=${from}&date%3C=${to}`);
    if (pts.length > 50) {
      await query('UPDATE circuit SET track_path = $1 WHERE id = (SELECT circuit_id FROM race WHERE season = $2 AND round = $3)', [JSON.stringify(pts.map((p) => [p.x, p.y])), SEASON, round]);
      console.log(`트랙 윤곽 ${pts.length}점`);
    }
  }

  // 6) 위치(리플레이): 드라이버별 10분 구간으로 받아 2초 간격으로 줄여 파일 1개로 저장
  const markDone = () => query('UPDATE session SET openf1_key = $1 WHERE id = $2', [key, sid]); // 끝까지 받은 뒤에만 표시한다
  if (values['skip-location']) return markDone();
  const t0 = +start, t1 = +new Date(info.date_end), STEP = 10 * 60 * 1000;
  const out = { sessionId: sid, startUtc: info.date_start, intervalMs: 2000, drivers: {} };
  for (const [num, d] of nums) {
    if (!d.id) continue;
    const track = [];
    let lastT = -Infinity;
    for (let t = t0; t < t1; t += STEP) {
      const iso = (x) => new Date(x).toISOString().slice(0, 19);
      for (const p of await openf1('location', { session_key: key, driver_number: num }, `&date%3E=${iso(t)}&date%3C=${iso(t + STEP)}`)) {
        const at = +new Date(p.date) - t0;
        if (at - lastT >= 2000) { track.push([at, p.x, p.y]); lastT = at; }
      }
    }
    out.drivers[d.code] = track;
    console.log(`  위치 ${d.code}: ${track.length}점`);
  }
  await mkdir(REPLAY_DIR, { recursive: true });
  await writeFile(`${REPLAY_DIR}${sid}.json`, JSON.stringify(out));
  console.log(`data/replay/${sid}.json 저장`);
  await markDone();
}

const races = await findRaces();
for (const race of races) {
  if (race.done && !values.round) { console.log(`R${race.round}: 이미 수집됨`); continue; }
  try {
    await collectRace(race);
  } catch (e) { // 한 레이스가 실패해도 나머지는 계속 받는다. 받은 원본은 캐시되어 다음 실행에서 이어진다.
    console.error(`R${race.round} 실패: ${e.message}`);
  }
}
await pool.end();
