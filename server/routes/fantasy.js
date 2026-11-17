// Fantasy 포디움 예측. 마감은 예선 시작 시각(없으면 결승 시작)이며 서버 시각으로만 판단한다.
import { Router } from 'express';
import { query } from '../db.js';
import { HttpError, intParam, seasonParam } from '../http.js';
import { requireAuth } from '../middleware/auth.js';
import { scorePending } from '../services/fantasy.js';

const router = Router();

const RACE_ROW = `SELECT ra.id, ra.season, ra.round, ra.name,
    COALESCE(q.start_utc, r.start_utc) AS deadline, (COALESCE(q.start_utc, r.start_utc) > now()) AS open,
    EXISTS (SELECT 1 FROM result x WHERE x.session_id = r.id) AS finished
  FROM race ra JOIN session r ON r.race_id = ra.id AND r.type = 'R' LEFT JOIN session q ON q.race_id = ra.id AND q.type = 'Q'`;

// 시즌의 레이스 목록(마감·진행 상태)
router.get('/races', async (req, res) => {
  const season = await seasonParam(req.query.season);
  const { rows } = await query(`${RACE_ROW} WHERE ra.season = $1 ORDER BY ra.round`, [season]);
  res.json({ season, races: rows.map((r) => ({ id: r.id, round: r.round, name: r.name, deadline: r.deadline, open: r.open, finished: r.finished })) });
});

// 예측할 수 있는 드라이버(그 시즌 엔트리)
router.get('/races/:id/drivers', async (req, res) => {
  const { rows } = await query(
    `SELECT d.id, d.name, d.code, e.number, t.id AS "teamId", t.name AS "teamName", t.color
       FROM race ra JOIN entry e ON e.season = ra.season JOIN driver d ON d.id = e.driver_id LEFT JOIN team t ON t.id = e.team_id
      WHERE ra.id = $1 ORDER BY t.name, d.name`, [intParam(req.params.id, 'id')]);
  res.json({ drivers: rows });
});

router.put('/predictions/:raceId', requireAuth, async (req, res) => {
  const raceId = intParam(req.params.raceId, 'raceId');
  const pick = [req.body?.p1, req.body?.p2, req.body?.p3];
  if (pick.some((d) => typeof d !== 'string' || !d) || new Set(pick).size !== 3) throw new HttpError(400, 'BAD_REQUEST', '서로 다른 드라이버 3명을 선택해 주세요.');
  const { rows } = await query(`${RACE_ROW} WHERE ra.id = $1`, [raceId]);
  if (!rows.length) throw new HttpError(404, 'NOT_FOUND', '레이스를 찾을 수 없습니다.');
  if (!rows[0].open) throw new HttpError(403, 'CLOSED', '예측이 마감되었습니다.');
  const { rows: valid } = await query('SELECT driver_id FROM entry WHERE season = $1 AND driver_id = ANY($2::text[])', [rows[0].season, pick]);
  if (valid.length !== 3) throw new HttpError(400, 'BAD_REQUEST', '이 시즌에 출전하지 않는 드라이버가 있습니다.');
  await query(
    `INSERT INTO fantasy_prediction (user_id, race_id, p1, p2, p3) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, race_id) DO UPDATE SET p1 = $3, p2 = $4, p3 = $5, updated_utc = now()`, [req.userId, raceId, ...pick]);
  res.json({ ok: true });
});

// 내 예측(시즌) + 채점 결과
router.get('/me', requireAuth, async (req, res) => {
  const season = await seasonParam(req.query.season);
  await scorePending();
  const { rows } = await query(
    `SELECT fp.race_id AS "raceId", ra.round, ra.name, fp.p1, fp.p2, fp.p3, fp.score, fp.exact,
            (SELECT array_agg(d.code ORDER BY n) FROM unnest(ARRAY[fp.p1, fp.p2, fp.p3]) WITH ORDINALITY u(id, n) JOIN driver d ON d.id = u.id) AS pick,
            (SELECT array_agg(d.code ORDER BY r.position) FROM result r JOIN session s ON s.id = r.session_id JOIN driver d ON d.id = r.driver_id
              WHERE s.race_id = fp.race_id AND s.type = 'R' AND r.position BETWEEN 1 AND 3) AS podium
       FROM fantasy_prediction fp JOIN race ra ON ra.id = fp.race_id WHERE fp.user_id = $1 AND ra.season = $2 ORDER BY ra.round DESC`, [req.userId, season]);
  res.json({ season, predictions: rows });
});

// 시즌 랭킹: 점수 합계 → 자리까지 맞힌 수 → 같으면 같은 순위. 정확도 = 자리 적중 ÷ (채점된 예측 × 3)
router.get('/ranking', async (req, res) => {
  const season = await seasonParam(req.query.season);
  await scorePending();
  const { rows } = await query(
    `SELECT u.id, u.nickname, SUM(fp.score)::int AS score, SUM(fp.exact)::int AS exact, COUNT(*)::int AS scored
       FROM fantasy_prediction fp JOIN app_user u ON u.id = fp.user_id JOIN race ra ON ra.id = fp.race_id
      WHERE ra.season = $1 AND fp.score IS NOT NULL GROUP BY u.id ORDER BY score DESC, exact DESC, u.nickname LIMIT 50`, [season]);
  let prev = null, rank = 0;
  const ranking = rows.map((r, i) => {
    if (!prev || prev.score !== r.score || prev.exact !== r.exact) rank = i + 1;
    prev = r;
    return { rank, nickname: r.nickname, score: r.score, exact: r.exact, scored: r.scored, accuracy: r.exact / (r.scored * 3) };
  });
  res.json({ season, ranking });
});

export default router;
