// 내 알림 조회·읽음 처리. 항상 본인 것만 다룬다.
import { Router } from 'express';
import { query } from '../db.js';
import { HttpError, intParam } from '../http.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const [{ rows }, { rows: [{ n }] }] = await Promise.all([
    query('SELECT id, kind, text, read, created_utc AS "createdUtc" FROM notification WHERE user_id = $1 ORDER BY created_utc DESC, id DESC LIMIT 50', [req.userId]),
    query('SELECT count(*)::int AS n FROM notification WHERE user_id = $1 AND NOT read', [req.userId]),
  ]);
  res.json({ unread: n, notifications: rows });
});

router.post('/read-all', async (req, res) => {
  await query('UPDATE notification SET read = true WHERE user_id = $1 AND NOT read', [req.userId]);
  res.json({ ok: true });
});

router.post('/:id/read', async (req, res) => {
  const { rowCount } = await query('UPDATE notification SET read = true WHERE id = $1 AND user_id = $2', [intParam(req.params.id, 'id'), req.userId]);
  if (!rowCount) throw new HttpError(404, 'NOT_FOUND', '알림을 찾을 수 없습니다.');
  res.json({ ok: true });
});

export default router;
