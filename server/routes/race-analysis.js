// 레이스 단위 분석 API: /api/races/:id/pace (Jolpica 랩별 시간·포지션으로 시즌 전체 레이스 가능)
import { Router } from 'express';
import { query } from '../db.js';
import { cached } from '../cache.js';
import { HttpError, intParam } from '../http.js';

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

export default router;
