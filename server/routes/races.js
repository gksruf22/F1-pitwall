// 시즌·일정·결과 API: /api/seasons, /api/races, /api/races/next, /api/races/:id/results
import { Router } from 'express';
import { query } from '../db.js';
import { cached } from '../cache.js';
import { HttpError, intParam, seasonParam } from '../http.js';

const router = Router();
const TTL = 60_000;

// 세션 시작 시각은 UTC(ISO)로 내려보내고 화면에서 KST로 바꾼다.
const RACE_SELECT = `
  SELECT ra.id, ra.season, ra.round, ra.name, ra.circuit_id,
         c.name AS circuit_name, c.country,
         (SELECT json_agg(json_build_object('type', s.type, 'startUtc', s.start_utc) ORDER BY s.start_utc)
            FROM session s WHERE s.race_id = ra.id) AS sessions,
         EXISTS (SELECT 1 FROM session s WHERE s.race_id = ra.id AND s.type = 'R' AND s.openf1_key IS NOT NULL) AS collected,
         EXISTS (SELECT 1 FROM session s JOIN result r ON r.session_id = s.id
                  WHERE s.race_id = ra.id AND s.type = 'R') AS finished
    FROM race ra LEFT JOIN circuit c ON c.id = ra.circuit_id`;

router.get('/seasons', async (req, res) => {
  const data = await cached('seasons', TTL, async () => {
    const { rows } = await query('SELECT year FROM season ORDER BY year DESC');
    return rows.map((r) => r.year);
  });
  res.json({ seasons: data });
});

router.get('/races', async (req, res) => {
  const season = await seasonParam(req.query.season);
  const races = await cached(`races:${season}`, TTL, async () => {
    const { rows } = await query(`${RACE_SELECT} WHERE ra.season = $1 ORDER BY ra.round`, [season]);
    return rows;
  });
  res.json({ season, races });
});

// 아직 시작하지 않은 결승 중 가장 가까운 레이스(시즌 종료 후에는 null)
router.get('/races/next', async (req, res) => {
  const race = await cached('races:next', 30_000, async () => {
    const { rows } = await query(
      `SELECT * FROM (${RACE_SELECT}) x
        WHERE EXISTS (SELECT 1 FROM session s WHERE s.race_id = x.id AND s.type = 'R' AND s.start_utc > now())
        ORDER BY season, round LIMIT 1`,
    );
    return rows[0] ?? null;
  });
  res.json({ race });
});

router.get('/races/:id/results', async (req, res) => {
  const id = intParam(req.params.id, 'id');
  const type = (req.query.session ?? 'R').toString().toUpperCase();
  if (!['R', 'Q', 'S', 'SQ'].includes(type)) throw new HttpError(400, 'BAD_REQUEST', 'session 값이 올바르지 않습니다.');
  const data = await cached(`results:${id}:${type}`, TTL, async () => {
    const { rows: races } = await query(`${RACE_SELECT} WHERE ra.id = $1`, [id]);
    if (!races[0]) return null;
    const { rows } = await query(
      `SELECT r.position, r.grid, r.points::float AS points, r.status,
              r.fastest_lap_ms AS "fastestLapMs", r.fastest_rank AS "fastestRank",
              r.q1_ms AS "q1Ms", r.q2_ms AS "q2Ms", r.q3_ms AS "q3Ms",
              d.id AS "driverId", d.code, d.name AS "driverName",
              t.id AS "teamId", t.name AS "teamName", t.color
         FROM result r
         JOIN session s ON s.id = r.session_id
         JOIN driver d ON d.id = r.driver_id
         LEFT JOIN team t ON t.id = r.team_id
        WHERE s.race_id = $1 AND s.type = $2
        ORDER BY r.position NULLS LAST, d.name`,
      [id, type],
    );
    return { race: races[0], session: type, results: rows };
  });
  if (!data) throw new HttpError(404, 'NOT_FOUND', '존재하지 않는 레이스입니다.');
  res.json(data);
});

export default router;
