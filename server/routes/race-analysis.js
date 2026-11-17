// 레이스·피트 분석 API: /api/races/:id/pace, /api/races/:id/strategy(수집 3건), /api/pitstops, /api/undercut (Jolpica 랩별 시간·포지션·피트레인 통과 시간으로 시즌 전체 가능)
import { Router } from 'express';
import { query } from '../db.js';
import { cached } from '../cache.js';
import { HttpError, intParam, seasonParam } from '../http.js';

const router = Router();
const TTL = 60_000;

const median = (v) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};

// clean=true: 1랩·인랩·아웃랩 제외 + 레이스 최속 랩의 cutoff% 초과 랩 제외(세이프티카 등). false: 전체 랩.
router.get('/races/:id/pace', async (req, res) => {
  const id = intParam(req.params.id, 'id');
  const clean = req.query.clean !== 'false';
  const cutoff = Number(req.query.cutoff ?? 107);
  if (!(cutoff >= 101 && cutoff <= 150)) throw new HttpError(400, 'BAD_REQUEST', 'cutoff 값은 101~150이어야 합니다.');

  const data = await cached(`pace:${id}:${clean}:${cutoff}`, TTL, async () => {
    const { rows: [race] } = await query('SELECT id, season, round, name FROM race WHERE id = $1', [id]);
    if (!race) return null;
    const [{ rows: drivers }, { rows: laps }, { rows: pits }] = await Promise.all([
      query(
        `SELECT d.id, d.code, d.name, t.id AS "teamId", t.color, r.position
           FROM result r JOIN session s ON s.id = r.session_id JOIN driver d ON d.id = r.driver_id
           LEFT JOIN team t ON t.id = r.team_id
          WHERE s.race_id = $1 AND s.type = 'R' ORDER BY r.position NULLS LAST`, [id]),
      query(
        `SELECT l.driver_id AS "driverId", l.lap, l.time_ms AS "timeMs", l.position
           FROM lap l JOIN session s ON s.id = l.session_id WHERE s.race_id = $1 AND s.type = 'R'`, [id]),
      query(
        `SELECT p.driver_id AS "driverId", p.lap FROM pit_stop p JOIN session s ON s.id = p.session_id
          WHERE s.race_id = $1 AND s.type = 'R'`, [id]),
    ]);
    if (!laps.length) return { race, totalLaps: 0, drivers: [], top: [] };

    const totalLaps = Math.max(...laps.map((l) => l.lap));
    const pitLaps = new Set(pits.flatMap((p) => [`${p.driverId}:${p.lap}`, `${p.driverId}:${p.lap + 1}`]));
    const structural = (l) => l.timeMs != null && l.lap > 1 && !pitLaps.has(`${l.driverId}:${l.lap}`);
    const ref = Math.min(...laps.filter(structural).map((l) => l.timeMs));
    const keep = (l) => (clean ? structural(l) && l.timeMs <= (ref * cutoff) / 100 : l.timeMs != null);

    const byDriver = Map.groupBy(laps, (l) => l.driverId);
    // 선두 대비 갭: 랩별 누적 시간의 최소값(=선두)과의 차. 중간에 시간이 빠진 랩이 있으면 그 뒤는 null.
    const cum = new Map();
    const leader = Array(totalLaps).fill(Infinity);
    for (const [did, ls] of byDriver) {
      const c = Array(totalLaps).fill(null);
      let sum = 0;
      for (const l of [...ls].sort((a, b) => a.lap - b.lap)) {
        if (l.timeMs == null || (l.lap > 1 && c[l.lap - 2] == null)) continue;
        sum += l.timeMs;
        c[l.lap - 1] = sum;
        leader[l.lap - 1] = Math.min(leader[l.lap - 1], sum);
      }
      cum.set(did, c);
    }

    const out = drivers.filter((d) => byDriver.has(d.id)).map((d) => {
      const times = Array(totalLaps).fill(null), positions = Array(totalLaps).fill(null);
      let best = null;
      for (const l of byDriver.get(d.id)) {
        positions[l.lap - 1] = l.position;
        if (!keep(l)) continue;
        times[l.lap - 1] = l.timeMs;
        if (!best || l.timeMs < best.timeMs) best = l;
      }
      const used = times.filter((t) => t != null);
      const gaps = cum.get(d.id).map((c, i) => (c == null ? null : c - leader[i]));
      return { ...d, times, positions, gaps, medianMs: median(used), bestMs: best?.timeMs ?? null, bestLap: best?.lap ?? null };
    });
    const top = out.filter((d) => d.bestMs != null).sort((a, b) => a.bestMs - b.bestMs).slice(0, 20)
      .map((d) => ({ id: d.id, code: d.code, name: d.name, teamId: d.teamId, color: d.color, lap: d.bestLap, timeMs: d.bestMs }));
    return { race, totalLaps, referenceMs: ref, drivers: out, top };
  });
  if (!data) throw new HttpError(404, 'NOT_FOUND', '존재하지 않는 레이스입니다.');
  res.json({ clean, cutoff, ...data });
});

// 피트스톱 통계(시즌). Jolpica 값은 피트레인 "통과 시간"이다. 서킷마다 피트레인 길이가 달라
// 팀·드라이버 비교는 레이스 중앙값 대비 차이(delta)로 하고, 90초 초과(적색기 중 정지 등)와 중앙값의 1.5배 초과 stop은 뺀다.
const OUTLIER = 1.5, MAX_LANE_MS = 90_000;
const avg = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

router.get('/pitstops', async (req, res) => {
  const season = await seasonParam(req.query.season);
  const data = await cached(`pitstops:${season}`, TTL, async () => {
    const { rows } = await query(
      `SELECT p.lap, p.lane_ms AS "laneMs", p.stop_ms AS "stopMs", ra.round, ra.name AS "raceName", ra.id AS "raceId",
              d.id AS "driverId", d.code, d.name AS "driverName", t.id AS "teamId", t.name AS "teamName", t.color
         FROM pit_stop p JOIN session s ON s.id = p.session_id JOIN race ra ON ra.id = s.race_id
         JOIN driver d ON d.id = p.driver_id
         LEFT JOIN result r ON r.session_id = p.session_id AND r.driver_id = p.driver_id
         LEFT JOIN team t ON t.id = r.team_id
        WHERE ra.season = $1 AND s.type = 'R'`, [season]);
    const lane = rows.filter((r) => r.laneMs != null);
    const sane = lane.filter((r) => r.laneMs <= MAX_LANE_MS);
    const med = new Map([...Map.groupBy(sane, (r) => r.round)].map(([k, v]) => [k, median(v.map((r) => r.laneMs))]));
    const used = sane.filter((r) => r.laneMs <= med.get(r.round) * OUTLIER).map((r) => ({ ...r, delta: r.laneMs - med.get(r.round) }));
    const who = (r) => ({ driverId: r.driverId, code: r.code, driverName: r.driverName, teamId: r.teamId, teamName: r.teamName, color: r.color });

    const summarize = (list, keyOf, pick) => [...Map.groupBy(list, keyOf)].map(([, v]) => ({
      ...pick(v[0]), n: v.length, avgDelta: avg(v.map((r) => r.delta)), avgLaneMs: avg(v.map((r) => r.laneMs)), deltas: v.map((r) => r.delta),
    }));
    const teams = summarize(used.filter((r) => r.teamId), (r) => r.teamId, (r) => ({ id: r.teamId, name: r.teamName, color: r.color })).sort((a, b) => a.avgDelta - b.avgDelta);
    const drivers = summarize(used, (r) => r.driverId, (r) => ({ id: r.driverId, code: r.code, name: r.driverName, teamId: r.teamId, color: r.color }))
      .filter((d) => d.n >= 5).sort((a, b) => a.avgDelta - b.avgDelta).map(({ deltas, ...d }) => d); // 표본 5건 미만은 제외

    const rounds = [...Map.groupBy(used, (r) => r.round)].sort((a, b) => a[0] - b[0]).map(([round, v]) => ({
      round, raceName: v[0].raceName, avgLaneMs: avg(v.map((r) => r.laneMs)),
      teams: Object.fromEntries([...Map.groupBy(v.filter((r) => r.teamId), (r) => r.teamId)].map(([k, x]) => [k, avg(x.map((r) => r.laneMs))])),
    }));
    const top = [...used].sort((a, b) => a.laneMs - b.laneMs).slice(0, 20)
      .map((r) => ({ ...who(r), laneMs: r.laneMs, lap: r.lap, round: r.round, raceName: r.raceName }));
    const stopTimes = rows.filter((r) => r.stopMs != null).sort((a, b) => a.stopMs - b.stopMs).slice(0, 10)
      .map((r) => ({ ...who(r), stopMs: r.stopMs, lap: r.lap, round: r.round, raceName: r.raceName }));
    const raceCount = new Set(lane.map((r) => r.round)).size;
    return {
      season,
      cards: {
        total: lane.length, excluded: lane.length - used.length, races: raceCount,
        avgLaneMs: avg(used.map((r) => r.laneMs)), medianLaneMs: median(used.map((r) => r.laneMs)),
        fastest: top[0] ?? null, perRace: raceCount ? lane.length / raceCount : null,
        bestTeam: teams[0] ? { id: teams[0].id, name: teams[0].name, avgDelta: teams[0].avgDelta } : null,
      },
      top, teams, drivers, rounds, stopTimes, stopRaces: [...new Set(rows.filter((r) => r.stopMs != null).map((r) => r.raceName))],
    };
  });
  res.json(data);
});

// 스틴트·스피드트랩(OpenF1 수집 레이스만). 스피드트랩 순위는 랩마다 그 랩에 기록이 있는 드라이버끼리 매긴다.
router.get('/races/:id/strategy', async (req, res) => {
  const id = intParam(req.params.id, 'id');
  const data = await cached(`strategy:${id}`, TTL, async () => {
    const { rows: [race] } = await query(
      `SELECT ra.id, ra.name, ra.round, s.id AS "sessionId" FROM race ra JOIN session s ON s.race_id = ra.id AND s.type = 'R'
        WHERE ra.id = $1 AND s.openf1_key IS NOT NULL`, [id]);
    if (!race) return null;
    const sid = race.sessionId;
    const [{ rows: drivers }, { rows: stints }, { rows: pits }, { rows: speeds }] = await Promise.all([
      query(`SELECT d.id, d.code, d.name, t.id AS "teamId", t.name AS "teamName", t.color, r.position FROM result r JOIN driver d ON d.id = r.driver_id
              LEFT JOIN team t ON t.id = r.team_id WHERE r.session_id = $1 ORDER BY r.position NULLS LAST, d.name`, [sid]),
      query('SELECT driver_id AS id, no, lap_from AS "from", lap_to AS "to", compound FROM stint WHERE session_id = $1 ORDER BY driver_id, no', [sid]),
      query('SELECT driver_id AS id, lap, stop_ms AS "stopMs" FROM pit_stop WHERE session_id = $1 ORDER BY lap', [sid]),
      query('SELECT driver_id AS id, lap, st_speed AS kmh FROM lap WHERE session_id = $1 AND st_speed IS NOT NULL', [sid]),
    ]);
    const totalLaps = Math.max(0, ...stints.map((s) => s.to ?? 0));
    const out = drivers.map((d) => ({
      ...d, stints: stints.filter((s) => s.id === d.id).map(({ id: _, ...s }) => s), pits: pits.filter((p) => p.id === d.id).map(({ id: _, ...p }) => p),
    })).filter((d) => d.stints.length);

    // 스피드트랩: 드라이버별 최고 속도 + 랩별 순위 분포(1~10위 횟수)
    const best = new Map();
    for (const s of speeds) if (!best.has(s.id) || s.kmh > best.get(s.id).kmh) best.set(s.id, s);
    const byId = new Map(drivers.map((d) => [d.id, d]));
    const top = [...best.values()].sort((a, b) => b.kmh - a.kmh).slice(0, 15).map((s) => ({ ...byId.get(s.id), kmh: s.kmh, lap: s.lap }));
    const counts = new Map(top.map((d) => [d.id, Array(10).fill(0)]));
    for (const lapSpeeds of Map.groupBy(speeds, (s) => s.lap).values()) {
      lapSpeeds.sort((a, b) => b.kmh - a.kmh).forEach((s, i) => { if (i < 10 && counts.has(s.id)) counts.get(s.id)[i]++; });
    }
    return {
      race: { id: race.id, name: race.name, round: race.round }, totalLaps, drivers: out,
      speedTrap: { top, ranks: top.map((d) => ({ code: d.code, counts: counts.get(d.id) })) },
    };
  });
  if (!data) throw new HttpError(404, 'NOT_FOUND', '스틴트·스피드트랩 데이터가 수집된 레이스가 아닙니다.');
  res.json(data);
});

// 언더컷/오버컷(시즌). 한 차(X)가 랩 p에 먼저 정지했고, 직전 랩(p-1) 끝에 3초 이내로 바로 앞·뒤에 있던 차(Y)가
// 이어서 1~5랩 안에 정지했다면 한 쌍으로 본다. 두 차가 모두 정지를 마친 뒤(Y의 정지 랩 + 2) 순서로 성공을 판정한다.
//  - Y가 앞차: X가 뒤에서 먼저 들어간 것(언더컷). 이후 X가 앞이면 UNDERCUT, 아니면 UNDERCUT_FAILED
//  - Y가 뒤차: X가 앞에서 먼저 들어간 것. 이후 Y가 앞이면 OVERCUT(Y가 더 버텨 추월), 아니면 DEFENDED
// 한계: 세이프티카·적기 구간과 정지 순서를 정할 수 없는 같은 랩 정지는 가려내지 않는다(같은 랩 정지는 제외).
const WINDOW_LAPS = 5, GAP_MS = 3000;

router.get('/undercut', async (req, res) => {
  const season = await seasonParam(req.query.season);
  const data = await cached(`undercut:${season}`, TTL, async () => {
    const [{ rows: laps }, { rows: pits }, { rows: info }] = await Promise.all([
      query(`SELECT l.session_id AS sid, l.driver_id AS d, l.lap, l.time_ms AS ms, l.position AS pos
               FROM lap l JOIN session s ON s.id = l.session_id JOIN race ra ON ra.id = s.race_id WHERE ra.season = $1 AND s.type = 'R'`, [season]),
      query(`SELECT p.session_id AS sid, p.driver_id AS d, p.lap FROM pit_stop p JOIN session s ON s.id = p.session_id
               JOIN race ra ON ra.id = s.race_id WHERE ra.season = $1 AND s.type = 'R' ORDER BY p.lap`, [season]),
      query(`SELECT s.id AS sid, ra.round, ra.name AS "raceName", r.driver_id AS d, dr.code, t.id AS "teamId", t.name AS "teamName", t.color
               FROM result r JOIN session s ON s.id = r.session_id JOIN race ra ON ra.id = s.race_id
               JOIN driver dr ON dr.id = r.driver_id LEFT JOIN team t ON t.id = r.team_id WHERE ra.season = $1 AND s.type = 'R'`, [season]),
    ]);
    const who = new Map(info.map((r) => [`${r.sid}:${r.d}`, r]));
    const events = [];
    const pitsBy = Map.groupBy(pits, (p) => p.sid);
    for (const [sid, ls] of Map.groupBy(laps, (l) => l.sid)) {
      const pos = new Map(), cum = new Map(); // `${driver}:${lap}` → 값
      for (const [d, mine] of Map.groupBy(ls, (l) => l.d)) {
        let sum = 0, ok = true;
        for (const l of mine.sort((a, b) => a.lap - b.lap)) {
          pos.set(`${d}:${l.lap}`, l.pos);
          if (l.ms == null) ok = false;
          if (ok) { sum += l.ms; cum.set(`${d}:${l.lap}`, sum); }
        }
      }
      const atLap = new Map(); // `${lap}:${position}` → driver
      for (const [k, v] of pos) { const i = k.lastIndexOf(':'); atLap.set(`${k.slice(i + 1)}:${v}`, k.slice(0, i)); }
      const stops = pitsBy.get(sid) ?? [];
      for (const x of stops) {
        const myPos = pos.get(`${x.d}:${x.lap - 1}`);
        if (!myPos) continue;
        for (const dir of [-1, 1]) { // -1: 바로 앞차, +1: 바로 뒤차
          const y = atLap.get(`${x.lap - 1}:${myPos + dir}`);
          if (!y) continue;
          const gap = Math.abs((cum.get(`${x.d}:${x.lap - 1}`) ?? NaN) - (cum.get(`${y}:${x.lap - 1}`) ?? NaN));
          if (!(gap <= GAP_MS)) continue;
          const ys = stops.find((s) => s.d === y && s.lap > x.lap && s.lap <= x.lap + WINDOW_LAPS);
          if (!ys) continue;
          const after = ys.lap + 2, px = pos.get(`${x.d}:${after}`), py = pos.get(`${y}:${after}`);
          if (px == null || py == null) continue;
          const xAhead = px < py;
          const type = dir === -1 ? (xAhead ? 'UNDERCUT' : 'UNDERCUT_FAILED') : (xAhead ? 'DEFENDED' : 'OVERCUT');
          const first = who.get(`${sid}:${x.d}`), second = who.get(`${sid}:${y}`);
          if (!first || !second) continue;
          events.push({ round: first.round, raceName: first.raceName, lap: x.lap, type, gapMs: gap,
            first: { code: first.code, teamId: first.teamId, teamName: first.teamName, color: first.color },
            second: { code: second.code, teamId: second.teamId, teamName: second.teamName, color: second.color } });
        }
      }
    }
    const count = (ty) => events.filter((e) => e.type === ty).length;
    const teamMap = new Map();
    const bump = (who, key) => {
      if (!who.teamId) return;
      if (!teamMap.has(who.teamId)) teamMap.set(who.teamId, { id: who.teamId, name: who.teamName, color: who.color, undercut: 0, undercutOk: 0, overcut: 0, overcutOk: 0 });
      teamMap.get(who.teamId)[key]++;
    };
    for (const e of events) {
      if (e.type === 'UNDERCUT' || e.type === 'UNDERCUT_FAILED') { bump(e.first, 'undercut'); if (e.type === 'UNDERCUT') bump(e.first, 'undercutOk'); }
      else { bump(e.second, 'overcut'); if (e.type === 'OVERCUT') bump(e.second, 'overcutOk'); } // 뒤차가 버틴 쪽이 오버컷 시도
    }
    return {
      season, window: WINDOW_LAPS, gapMs: GAP_MS,
      totals: { undercut: count('UNDERCUT') + count('UNDERCUT_FAILED'), undercutOk: count('UNDERCUT'), overcut: count('OVERCUT') + count('DEFENDED'), overcutOk: count('OVERCUT') },
      teams: [...teamMap.values()].sort((a, b) => b.undercutOk - a.undercutOk),
      events: events.sort((a, b) => b.round - a.round || b.lap - a.lap).slice(0, 60),
    };
  });
  res.json(data);
});

export default router;
