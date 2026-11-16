// GET /api/summary?season= : 대시보드용 요약(직전 포디움·진행률·챔피언십 격차·Top 5)
import { Router } from 'express';
import { query } from '../db.js';
import { cached } from '../cache.js';
import { seasonParam } from '../http.js';
import { getStandings } from '../services/standings.js';

const router = Router();

router.get('/', async (req, res) => {
  const season = await seasonParam(req.query.season);
  const data = await cached(`summary:${season}`, 60_000, async () => {
    const [drivers, constructors] = await Promise.all([
      getStandings(season, 'driver'),
      getStandings(season, 'constructor'),
    ]);
    const { rows: counts } = await query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE EXISTS (SELECT 1 FROM session s JOIN result r ON r.session_id = s.id
                                              WHERE s.race_id = ra.id AND s.type = 'R'))::int AS done
         FROM race ra WHERE ra.season = $1`,
      [season],
    );
    const { rows: podium } = await query(
      `SELECT ra.round, ra.name AS "raceName", ra.id AS "raceId", r.position,
              d.code, d.name AS "driverName", t.id AS "teamId", t.name AS "teamName", t.color
         FROM result r
         JOIN session s ON s.id = r.session_id AND s.type = 'R'
         JOIN race ra ON ra.id = s.race_id AND ra.season = $1 AND ra.round = $2
         JOIN driver d ON d.id = r.driver_id
         LEFT JOIN team t ON t.id = r.team_id
        WHERE r.position <= 3 ORDER BY r.position`,
      [season, drivers.round],
    );
    // 최단 피트스톱: Jolpica는 피트레인 통과 시간이다(정지 시간 아님). 기준을 화면에 함께 표기한다.
    const { rows: pit } = await query(
      `SELECT p.lane_ms AS "laneMs", p.lap, d.code, d.name AS "driverName", ra.name AS "raceName", ra.round
         FROM pit_stop p JOIN session s ON s.id = p.session_id JOIN race ra ON ra.id = s.race_id JOIN driver d ON d.id = p.driver_id
        WHERE ra.season = $1 AND p.lane_ms IS NOT NULL ORDER BY p.lane_ms LIMIT 1`,
      [season],
    );
    const gap = (list) => (list.length > 1 ? list[0].points - list[1].points : null);
    return {
      season,
      progress: counts[0],
      lastRace: podium.length ? { round: podium[0].round, name: podium[0].raceName, raceId: podium[0].raceId, podium } : null,
      championship: {
        driverLeader: drivers.standings[0] ?? null,
        driverGap: gap(drivers.standings),
        constructorLeader: constructors.standings[0] ?? null,
        constructorGap: gap(constructors.standings),
      },
      topDrivers: drivers.standings.slice(0, 5),
      fastestPit: pit[0] ?? null,
    };
  });
  res.json(data);
});

export default router;
