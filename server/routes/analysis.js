// 분석 API: /api/analysis/driver-stats/:id, /consistency, /h2h, /h2h/presets, /qualifying-gap (모두 result·lap에서 SQL로 계산, 저장하지 않음)
import { Router } from 'express';
import { query } from '../db.js';
import { cached } from '../cache.js';
import { HttpError, seasonParam } from '../http.js';
import { getStandings } from '../services/standings.js';

const router = Router();
const TTL = 60_000;

// 완주 인정: Finished·Lapped. 그 외(Retired, Did not start 등)는 DNF로 센다.
const classified = (status) => status === 'Finished' || status === 'Lapped';
const median = (v) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};

// ---- Driver Stats ----
router.get('/driver-stats/:id', async (req, res) => {
  const { id } = req.params;
  const season = await seasonParam(req.query.season);
  const data = await cached(`dstats:${id}:${season}`, TTL, async () => {
    const { rows: [driver] } = await query('SELECT id, code, name FROM driver WHERE id = $1', [id]);
    if (!driver) return null;
    const [{ standings }, { rows: races }, { rows: results }, { rows: lead }, { rows: trend }] = await Promise.all([
      getStandings(season, 'driver'),
      query('SELECT id, round, name FROM race WHERE season = $1 ORDER BY round', [season]),
      query(
        `SELECT ra.round, s.type, r.grid, r.position, r.points::float AS points, r.status, r.driver_id
           FROM result r JOIN session s ON s.id = r.session_id JOIN race ra ON ra.id = s.race_id
          WHERE ra.season = $1 AND r.driver_id = $2 AND s.type IN ('R', 'Q', 'S')`,
        [season, id],
      ),
      query(
        `SELECT ra.round, count(*)::int AS laps FROM lap l JOIN session s ON s.id = l.session_id
           JOIN race ra ON ra.id = s.race_id WHERE ra.season = $1 AND l.driver_id = $2 AND l.position = 1 GROUP BY ra.round`,
        [season, id],
      ),
      query(
        `SELECT ra.season, ra.round, sum(r.points)::float AS points
           FROM result r JOIN session s ON s.id = r.session_id JOIN race ra ON ra.id = s.race_id
          WHERE r.driver_id = $1 AND ra.season IN ($2, $3) AND s.type IN ('R', 'S') GROUP BY ra.season, ra.round ORDER BY ra.round`,
        [id, season, season - 1],
      ),
    ]);
    const me = standings.find((e) => e.id === id) ?? null;
    const mate = me && standings.filter((e) => e.teamId === me.teamId && e.id !== id).sort((a, b) => b.points - a.points)[0];
    const team = me && (await getStandings(season, 'constructor')).standings.find((e) => e.id === me.teamId);

    const byRound = new Map(races.map((r) => [r.round, { round: r.round, raceName: r.name, raceId: r.id, done: false }]));
    for (const r of results) {
      const row = byRound.get(r.round);
      if (r.type === 'R') Object.assign(row, { done: true, position: r.position, points: r.points, grid: r.grid, dnf: !classified(r.status) });
      if (r.type === 'Q') row.pole = r.position === 1;
      if (r.type === 'S') row.sprint = { position: r.position, points: r.points };
    }
    for (const l of lead) byRound.get(l.round).ledLaps = l.laps;
    const rounds = [...byRound.values()];
    const raced = rounds.filter((r) => r.done);

    const dist = {};
    for (const r of raced.filter((x) => !x.dnf && x.position)) dist[r.position] = (dist[r.position] ?? 0) + 1;
    const pointsFinish = raced.filter((r) => !r.dnf && r.position <= 10).length;

    // 이번 시즌·전년 라운드별 누적 포인트 (전년 데이터가 DB에 없으면 이번 시즌만)
    const cumulative = (yr) => {
      const rows = trend.filter((t) => t.season === yr);
      if (!rows.length) return null;
      let sum = 0;
      const byR = new Map(rows.map((t) => [t.round, t.points]));
      return Array.from({ length: Math.max(...rows.map((t) => t.round)) }, (_, i) => (sum += byR.get(i + 1) ?? 0));
    };
    const avg = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
    let mateAvg = null;
    if (mate) {
      const { rows } = await query(
        `SELECT avg(r.position)::float AS avg FROM result r JOIN session s ON s.id = r.session_id JOIN race ra ON ra.id = s.race_id
          WHERE ra.season = $1 AND s.type = 'R' AND r.driver_id = $2 AND r.status IN ('Finished', 'Lapped')`,
        [season, mate.id],
      );
      mateAvg = rows[0].avg;
    }
    return {
      season, driver,
      standing: me && { position: me.position, points: me.points, teamId: me.teamId, teamName: me.teamName, color: me.color },
      summary: me && {
        isLeader: me.position === 1,
        gapToP2: me.position === 1 ? me.points - (standings[1]?.points ?? 0) : me.gapToLeader, // 선두면 2위와의 차, 아니면 선두와의 차
        teamShare: team?.points ? (me.points / team.points) * 100 : null,
        teammate: mate && { id: mate.id, code: mate.code, points: mate.points, gap: me.points - mate.points },
        avgFinish: avg(raced.filter((r) => !r.dnf && r.position).map((r) => r.position)),
        teammateAvgFinish: mateAvg,
      },
      rounds,
      totals: {
        wins: raced.filter((r) => r.position === 1 && !r.dnf).length,
        podiums: raced.filter((r) => r.position <= 3 && !r.dnf).length,
        points: me?.points ?? 0,
        poles: rounds.filter((r) => r.pole).length,
      },
      pointsFinish: { points: pointsFinish, noPoints: raced.length - pointsFinish - raced.filter((r) => r.dnf).length, dnf: raced.filter((r) => r.dnf).length },
      finishDistribution: dist,
      trend: [season - 1, season].map((yr) => ({ season: yr, points: cumulative(yr) })).filter((t) => t.points),
    };
  });
  if (!data) throw new HttpError(404, 'NOT_FOUND', '존재하지 않는 드라이버입니다.');
  res.json(data);
});

// ---- 일관성: 드라이버별 순위 분포(박스플롯 입력) ----
router.get('/consistency', async (req, res) => {
  const season = await seasonParam(req.query.season);
  const excludeDnf = req.query.excludeDnf === 'true';
  const data = await cached(`consistency:${season}:${excludeDnf}`, TTL, async () => {
    const { rows } = await query(
      `SELECT s.type, r.position, r.status, d.id, d.code, d.name, t.id AS "teamId", t.color
         FROM result r JOIN session s ON s.id = r.session_id JOIN race ra ON ra.id = s.race_id
         JOIN driver d ON d.id = r.driver_id LEFT JOIN team t ON t.id = r.team_id
        WHERE ra.season = $1 AND s.type IN ('R', 'S', 'Q') AND r.position IS NOT NULL`,
      [season],
    );
    const build = (type) => {
      const by = new Map();
      for (const r of rows.filter((x) => x.type === type)) {
        if (excludeDnf && type !== 'Q' && !classified(r.status)) continue;
        const e = by.get(r.id) ?? { id: r.id, code: r.code, name: r.name, teamId: r.teamId, color: r.color, positions: [] };
        e.positions.push(r.position);
        e.teamId = r.teamId; e.color = r.color;
        by.set(r.id, e);
      }
      return [...by.values()].filter((e) => e.positions.length >= 3)
        .map((e) => ({ ...e, median: median(e.positions) })).sort((a, b) => a.median - b.median);
    };
    return {
      season, excludeDnf,
      race: build('R'), sprint: build('S'), qualifying: build('Q'),
      // 스프린트 예선 결과는 Jolpica에 없어 이번 단계에서는 제공하지 않는다.
      sprintQualifying: null,
      cutoffs: { race: [{ value: 10, label: '포인트권(P10)' }], sprint: [{ value: 8, label: '포인트권(P8)' }], qualifying: [{ value: 15, label: 'Q2 진출(P15)' }, { value: 10, label: 'Q3 진출(P10)' }] },
    };
  });
  res.json(data);
});

// ---- 헤드투헤드 ----
async function loadPair(season, a, b) {
  const { rows } = await query(
    `SELECT ra.round, ra.name AS "raceName", s.type, r.driver_id AS "driverId", r.position, r.status
       FROM result r JOIN session s ON s.id = r.session_id JOIN race ra ON ra.id = s.race_id
      WHERE ra.season = $1 AND r.driver_id = ANY($2) AND s.type IN ('R', 'Q', 'S') ORDER BY ra.round`,
    [season, [a, b]],
  );
  return rows;
}

// 한 세션 종류의 승수. 결승·스프린트는 한쪽만 DNF면 완주한 쪽 승, 둘 다 DNF면 집계 제외. 예선은 순위만 본다.
function duel(rows, type, a, b) {
  const out = { a: 0, b: 0, rounds: [] };
  const rounds = [...new Set(rows.filter((r) => r.type === type).map((r) => r.round))];
  for (const round of rounds) {
    const ra = rows.find((r) => r.type === type && r.round === round && r.driverId === a);
    const rb = rows.find((r) => r.type === type && r.round === round && r.driverId === b);
    if (!ra || !rb || ra.position == null || rb.position == null) continue;
    const okA = type === 'Q' || classified(ra.status), okB = type === 'Q' || classified(rb.status);
    let winner = null;
    if (okA && okB) winner = ra.position < rb.position ? 'a' : 'b';
    else if (okA !== okB) winner = okA ? 'a' : 'b';
    if (winner) out[winner]++;
    out.rounds.push({ round, raceName: ra.raceName, a: ra.position, b: rb.position, aDnf: !okA, bDnf: !okB, winner });
  }
  return out;
}

router.get('/h2h', async (req, res) => {
  const season = await seasonParam(req.query.season);
  const { a, b } = req.query;
  if (!a || !b || a === b) throw new HttpError(400, 'BAD_REQUEST', '서로 다른 드라이버 2명(a, b)을 선택하세요.');
  const data = await cached(`h2h:${season}:${a}:${b}`, TTL, async () => {
    const { rows: people } = await query(
      `SELECT d.id, d.code, d.name, (SELECT t.id FROM entry e JOIN team t ON t.id = e.team_id WHERE e.season = $1 AND e.driver_id = d.id LIMIT 1) AS "teamId",
              (SELECT t.color FROM entry e JOIN team t ON t.id = e.team_id WHERE e.season = $1 AND e.driver_id = d.id LIMIT 1) AS color
         FROM driver d WHERE d.id = ANY($2)`,
      [season, [a, b]],
    );
    if (people.length < 2) return null;
    const rows = await loadPair(season, a, b);
    return {
      season, a: people.find((p) => p.id === a), b: people.find((p) => p.id === b),
      qualifying: duel(rows, 'Q', a, b), race: duel(rows, 'R', a, b), sprint: duel(rows, 'S', a, b),
    };
  });
  if (!data) throw new HttpError(404, 'NOT_FOUND', '존재하지 않는 드라이버입니다.');
  res.json(data);
});

// 인기 비교 프리셋: 같은 팀 팀메이트 쌍(시즌 중 교체로 3명 이상이면 포인트 상위 2명)
router.get('/h2h/presets', async (req, res) => {
  const season = await seasonParam(req.query.season);
  const presets = await cached(`h2h-presets:${season}`, TTL, async () => {
    const { standings } = await getStandings(season, 'driver');
    const byTeam = new Map();
    for (const e of standings) byTeam.set(e.teamId, [...(byTeam.get(e.teamId) ?? []), e]);
    return [...byTeam.values()].filter((l) => l.length >= 2).map(([x, y]) => ({
      teamId: x.teamId, teamName: x.teamName, color: x.color,
      a: { id: x.id, code: x.code, name: x.name }, b: { id: y.id, code: y.code, name: y.name },
    }));
  });
  res.json({ season, presets });
});

// 팀메이트 예선 격차 + 팀 폴 대비 격차.
// 팀의 기준 드라이버 = 그 시즌 해당 팀 예선 출전이 가장 많은 사람. 같은 라운드에 기준 드라이버와 다른 팀메이트가 모두
// 기록이 있으면, 둘 다 시간이 있는 가장 마지막 단계(Q3>Q2>Q1)의 기록을 비교한다. gapMs = 기준 − 팀메이트(음수 = 기준이 빠름).
// 폴 대비 격차 = Q3에 오른 팀 드라이버 중 최고 기록 − 그 라운드 폴 기록의 평균.
router.get('/qualifying-gap', async (req, res) => {
  const season = await seasonParam(req.query.season);
  const data = await cached(`qgap:${season}`, TTL, async () => {
    const { rows } = await query(
      `SELECT ra.round, ra.name AS "raceName", r.q1_ms AS q1, r.q2_ms AS q2, r.q3_ms AS q3,
              d.id AS "driverId", d.code, t.id AS "teamId", t.name AS "teamName", t.color
         FROM result r JOIN session s ON s.id = r.session_id JOIN race ra ON ra.id = s.race_id
         JOIN driver d ON d.id = r.driver_id JOIN team t ON t.id = r.team_id
        WHERE ra.season = $1 AND s.type = 'Q'`, [season]);
    const poles = new Map();
    for (const r of rows) if (r.q3 != null) poles.set(r.round, Math.min(poles.get(r.round) ?? Infinity, r.q3));

    const teams = [...Map.groupBy(rows, (r) => r.teamId)].map(([id, list]) => {
      const counts = new Map();
      for (const r of list) counts.set(r.driverId, (counts.get(r.driverId) ?? 0) + 1);
      const refId = [...counts].sort((a, b) => b[1] - a[1])[0][0];
      const ref = list.find((r) => r.driverId === refId);
      const points = [];
      for (const [round, rs] of Map.groupBy(list, (r) => r.round)) {
        const me = rs.find((r) => r.driverId === refId);
        const mate = rs.find((r) => r.driverId !== refId);
        if (!me || !mate) continue;
        const stage = ['q3', 'q2', 'q1'].find((k) => me[k] != null && mate[k] != null);
        if (stage) points.push({ round, raceName: me.raceName, stage: stage.toUpperCase(), gapMs: me[stage] - mate[stage], mate: mate.code });
      }
      const poleGaps = [...Map.groupBy(list.filter((r) => r.q3 != null), (r) => r.round)]
        .map(([round, rs]) => Math.min(...rs.map((r) => r.q3)) - poles.get(round));
      return {
        id, name: ref.teamName, color: ref.color, refCode: ref.code, points: points.sort((a, b) => a.round - b.round),
        avgGapMs: points.length ? points.reduce((s, p) => s + p.gapMs, 0) / points.length : null,
        poleGapMs: poleGaps.length ? poleGaps.reduce((s, v) => s + v, 0) / poleGaps.length : null, poleRounds: poleGaps.length,
      };
    }).sort((a, b) => (a.poleGapMs ?? Infinity) - (b.poleGapMs ?? Infinity));
    return { season, teams };
  });
  res.json(data);
});

export default router;
