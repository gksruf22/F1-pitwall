// 프로필 API: /api/drivers, /api/drivers/:id, /api/teams, /api/teams/:id, /api/circuits, /api/circuits/:id
import { Router } from 'express';
import { query } from '../db.js';
import { cached } from '../cache.js';
import { HttpError, seasonParam } from '../http.js';
import { getStandings } from '../services/standings.js';

const router = Router();
const TTL = 60_000;
const byId = (list) => new Map(list.map((e) => [e.id, e]));

// ---- 드라이버 ----
router.get('/drivers', async (req, res) => {
  const season = await seasonParam(req.query.season);
  const drivers = await cached(`drivers:${season}`, TTL, async () => {
    const [{ rows }, { standings }] = await Promise.all([
      query(
        `SELECT d.id, d.code, d.name, d.nationality, e.number, t.id AS "teamId", t.name AS "teamName", t.color
           FROM entry e JOIN driver d ON d.id = e.driver_id JOIN team t ON t.id = e.team_id
          WHERE e.season = $1`,
        [season],
      ),
      getStandings(season, 'driver'),
    ]);
    const st = byId(standings);
    // 시즌 중 이적한 드라이버는 소속 기록이 여러 건이므로, 순위 계산이 쓰는 최근 소속 팀 한 건만 남긴다.
    const latest = rows.filter((d) => !st.has(d.id) || st.get(d.id).teamId === d.teamId);
    return [...new Map(latest.map((d) => [d.id, d])).values()]
      .map((d) => ({ ...d, position: st.get(d.id)?.position ?? null, points: st.get(d.id)?.points ?? 0 }))
      .sort((a, b) => (a.position ?? 99) - (b.position ?? 99) || a.name.localeCompare(b.name));
  });
  res.json({ season, drivers });
});

router.get('/drivers/:id', async (req, res) => {
  const { id } = req.params;
  const season = await seasonParam(req.query.season);
  const data = await cached(`driver:${id}:${season}`, TTL, async () => {
    const { rows: [driver] } = await query('SELECT id, code, name, nationality, birth::text AS birth FROM driver WHERE id = $1', [id]);
    if (!driver) return null;
    const [{ rows: seasons }, { rows: entry }, { rows: results }, { standings }] = await Promise.all([
      query('SELECT DISTINCT season FROM entry WHERE driver_id = $1 ORDER BY season DESC', [id]),
      query(
        `SELECT e.number, t.id AS "teamId", t.name AS "teamName", t.color
           FROM entry e JOIN team t ON t.id = e.team_id WHERE e.season = $1 AND e.driver_id = $2`,
        [season, id],
      ),
      query(
        `SELECT ra.id AS "raceId", ra.round, ra.name AS "raceName", s.type,
                r.grid, r.position, r.points::float AS points, r.status, r.fastest_rank AS "fastestRank"
           FROM result r JOIN session s ON s.id = r.session_id JOIN race ra ON ra.id = s.race_id
          WHERE ra.season = $1 AND r.driver_id = $2 AND s.type IN ('R', 'Q', 'S')
          ORDER BY ra.round`,
        [season, id],
      ),
      getStandings(season, 'driver'),
    ]);
    // 라운드별로 결승·예선·스프린트를 한 줄로 묶는다.
    const rounds = new Map();
    for (const r of results) {
      const row = rounds.get(r.round) ?? { raceId: r.raceId, round: r.round, raceName: r.raceName };
      if (r.type === 'R') Object.assign(row, { grid: r.grid, position: r.position, points: r.points, status: r.status, fastest: r.fastestRank === 1 });
      if (r.type === 'Q') row.qualiPosition = r.position;
      if (r.type === 'S') Object.assign(row, { sprintPosition: r.position, sprintPoints: r.points });
      rounds.set(r.round, row);
    }
    const st = standings.find((e) => e.id === id) ?? null;
    return {
      season,
      driver,
      seasons: seasons.map((x) => x.season),
      entry: entry.find((e) => e.teamId === st?.teamId) ?? entry[0] ?? null, // 이적 시 최근 소속 팀
      standing: st && { position: st.position, points: st.points, wins: st.wins, gapToLeader: st.gapToLeader },
      results: [...rounds.values()],
    };
  });
  if (!data) throw new HttpError(404, 'NOT_FOUND', '존재하지 않는 드라이버입니다.');
  res.json(data);
});

// ---- 팀 ----
router.get('/teams', async (req, res) => {
  const season = await seasonParam(req.query.season);
  const teams = await cached(`teams:${season}`, TTL, async () => {
    const [{ rows }, { standings }] = await Promise.all([
      query(
        `SELECT t.id, t.name, t.color,
                json_agg(json_build_object('id', d.id, 'code', d.code, 'name', d.name) ORDER BY d.name) AS drivers
           FROM entry e JOIN team t ON t.id = e.team_id JOIN driver d ON d.id = e.driver_id
          WHERE e.season = $1 GROUP BY t.id, t.name, t.color`,
        [season],
      ),
      getStandings(season, 'constructor'),
    ]);
    const st = byId(standings);
    return rows
      .map((t) => ({ ...t, position: st.get(t.id)?.position ?? null, points: st.get(t.id)?.points ?? 0 }))
      .sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  });
  res.json({ season, teams });
});

router.get('/teams/:id', async (req, res) => {
  const { id } = req.params;
  const season = await seasonParam(req.query.season);
  const data = await cached(`team:${id}:${season}`, TTL, async () => {
    const { rows: [team] } = await query('SELECT id, name, color FROM team WHERE id = $1', [id]);
    if (!team) return null;
    const [{ rows: drivers }, { rows: rounds }, { standings }, { rows: seasons }] = await Promise.all([
      query(
        `SELECT d.id, d.code, d.name, d.nationality, e.number
           FROM entry e JOIN driver d ON d.id = e.driver_id WHERE e.season = $1 AND e.team_id = $2 ORDER BY d.name`,
        [season, id],
      ),
      // 라운드별 팀 포인트(결승+스프린트)와 소속 드라이버별 내역
      query(
        `SELECT ra.round, ra.id AS "raceId", ra.name AS "raceName", d.code,
                sum(r.points)::float AS points,
                min(r.position) FILTER (WHERE s.type = 'R') AS position
           FROM result r JOIN session s ON s.id = r.session_id JOIN race ra ON ra.id = s.race_id
           JOIN driver d ON d.id = r.driver_id
          WHERE ra.season = $1 AND r.team_id = $2 AND s.type IN ('R', 'S')
          GROUP BY ra.round, ra.id, ra.name, d.code ORDER BY ra.round, d.code`,
        [season, id],
      ),
      getStandings(season, 'constructor'),
      query('SELECT DISTINCT season FROM entry WHERE team_id = $1 ORDER BY season DESC', [id]),
    ]);
    const byRound = new Map();
    for (const r of rounds) {
      const row = byRound.get(r.round) ?? { raceId: r.raceId, round: r.round, raceName: r.raceName, points: 0, drivers: [] };
      row.points += r.points;
      row.drivers.push({ code: r.code, position: r.position, points: r.points });
      byRound.set(r.round, row);
    }
    const st = standings.find((e) => e.id === id) ?? null;
    return {
      season, team, drivers, seasons: seasons.map((x) => x.season),
      standing: st && { position: st.position, points: st.points, wins: st.wins, gapToLeader: st.gapToLeader },
      results: [...byRound.values()],
    };
  });
  if (!data) throw new HttpError(404, 'NOT_FOUND', '존재하지 않는 팀입니다.');
  res.json(data);
});

// ---- 서킷 ----
router.get('/circuits', async (req, res) => {
  const circuits = await cached('circuits', TTL, async () => {
    const { rows } = await query(
      `SELECT c.id, c.name, c.country, count(ra.id)::int AS races, max(ra.season) AS "lastSeason"
         FROM circuit c LEFT JOIN race ra ON ra.circuit_id = c.id GROUP BY c.id ORDER BY c.country, c.name`,
    );
    return rows;
  });
  res.json({ circuits });
});

router.get('/circuits/:id', async (req, res) => {
  const { id } = req.params;
  const data = await cached(`circuit:${id}`, TTL, async () => {
    const { rows: [circuit] } = await query(
      'SELECT id, name, country, lat, lon, length_km AS "lengthKm", turns FROM circuit WHERE id = $1', [id]);
    if (!circuit) return null;
    const { rows: races } = await query(
      `SELECT ra.id, ra.season, ra.round, ra.name,
              (SELECT s.start_utc FROM session s WHERE s.race_id = ra.id AND s.type = 'R') AS "startUtc",
              (SELECT json_build_object('code', d.code, 'name', d.name, 'teamName', t.name)
                 FROM session s JOIN result r ON r.session_id = s.id AND r.position = 1
                 JOIN driver d ON d.id = r.driver_id LEFT JOIN team t ON t.id = r.team_id
                WHERE s.race_id = ra.id AND s.type = 'R') AS winner
         FROM race ra WHERE ra.circuit_id = $1 ORDER BY ra.season DESC, ra.round`,
      [id],
    );
    return { circuit, races };
  });
  if (!data) throw new HttpError(404, 'NOT_FOUND', '존재하지 않는 서킷입니다.');
  res.json(data);
});

export default router;
