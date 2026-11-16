// GET /api/standings/drivers|constructors?season=&round=
import { Router } from 'express';
import { HttpError, intParam, seasonParam } from '../http.js';
import { getStandings } from '../services/standings.js';

const router = Router();

async function send(kind, req, res) {
  const season = await seasonParam(req.query.season);
  const round = intParam(req.query.round, 'round');
  const data = await getStandings(season, kind, round);
  if (!data.standings.length) throw new HttpError(404, 'NO_DATA', '해당 시즌·라운드의 결과가 없습니다.');
  res.json(data);
}

router.get('/drivers', (req, res) => send('driver', req, res));
router.get('/constructors', (req, res) => send('constructor', req, res));

export default router;
