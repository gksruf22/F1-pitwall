// 즐겨찾기(드라이버·팀). 모든 요청은 로그인 필요, 항상 본인 것만 다룬다.
import { Router } from 'express';
import { query } from '../db.js';
import { HttpError } from '../http.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const TABLE = { driver: 'driver', team: 'team' }; // kind → 존재 확인용 테이블(고정 값만 쓰므로 SQL에 넣어도 안전)
const kindOf = (k) => { if (!TABLE[k]) throw new HttpError(400, 'BAD_REQUEST', 'kind는 driver 또는 team이어야 합니다.'); return TABLE[k]; };

router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT f.kind, f.ref_id AS id, COALESCE(d.name, t.name) AS name, COALESCE(d.code, '') AS code, t.color
       FROM favorite f LEFT JOIN driver d ON f.kind = 'driver' AND d.id = f.ref_id
                       LEFT JOIN team t ON f.kind = 'team' AND t.id = f.ref_id
      WHERE f.user_id = $1 ORDER BY f.kind, name`, [req.userId]);
  res.json({ favorites: rows });
});

router.put('/:kind/:id', async (req, res) => {
  const table = kindOf(req.params.kind);
  const { rowCount } = await query(`SELECT 1 FROM ${table} WHERE id = $1`, [req.params.id]);
  if (!rowCount) throw new HttpError(404, 'NOT_FOUND', '대상을 찾을 수 없습니다.');
  await query('INSERT INTO favorite (user_id, kind, ref_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [req.userId, req.params.kind, req.params.id]);
  res.json({ ok: true });
});

router.delete('/:kind/:id', async (req, res) => {
  kindOf(req.params.kind);
  await query('DELETE FROM favorite WHERE user_id = $1 AND kind = $2 AND ref_id = $3', [req.userId, req.params.kind, req.params.id]);
  res.json({ ok: true });
});

export default router;
