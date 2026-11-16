// GET /api/news?page=&limit= : 저장된 헤드라인(출처·날짜·원문 링크)을 최신순으로
import { Router } from 'express';
import { query } from '../db.js';
import { cached } from '../cache.js';
import { intParam } from '../http.js';

const router = Router();

router.get('/', async (req, res) => {
  const page = intParam(req.query.page, 'page', 1);
  const limit = Math.min(intParam(req.query.limit, 'limit', 12), 50);
  const data = await cached(`news:${page}:${limit}`, 60_000, async () => {
    const [{ rows }, { rows: [{ total }] }] = await Promise.all([
      query('SELECT id, source, title, url, published_utc AS "publishedUtc" FROM news ORDER BY published_utc DESC NULLS LAST LIMIT $1 OFFSET $2', [limit, (page - 1) * limit]),
      query('SELECT count(*)::int AS total FROM news'),
    ]);
    return { items: rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
  });
  res.json(data);
});

export default router;
