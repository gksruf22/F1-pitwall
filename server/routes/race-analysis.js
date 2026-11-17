// 레이스·피트 분석 API: /api/races/:id/pace, /api/pitstops (Jolpica 랩별 시간·포지션·피트레인 통과 시간으로 시즌 전체 가능)
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

export default router;
