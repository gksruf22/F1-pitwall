// GET /api/highlights?filter=all|race|driver|team&limit= : 규칙 기반 하이라이트 피드
import { Router } from 'express';
import { HttpError, intParam, seasonParam } from '../http.js';
import { getHighlights } from '../services/highlights.js';
import { withPolished } from '../services/ai-highlights.js';

const router = Router();
const KINDS = ['all', 'race', 'driver', 'team'];

router.get('/', async (req, res) => {
  const filter = req.query.filter ?? 'all';
  if (!KINDS.includes(filter)) throw new HttpError(400, 'BAD_REQUEST', 'filter 값이 올바르지 않습니다.');
  const season = await seasonParam(req.query.season);
  const limit = Math.min(intParam(req.query.limit, 'limit', 12), 50);
  const all = await getHighlights(season);
  const items = all.filter((h) => filter === 'all' || h.kind === filter).slice(0, limit);
  res.json({ season, filter, items: await withPolished(items) });
});

export default router;
