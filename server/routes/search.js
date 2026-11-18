// GET /api/search?q= : 뉴스·드라이버·팀·서킷·레이스·게시글을 유형별로 묶어 돌려준다.
import { Router } from 'express';
import { query } from '../db.js';
import { HttpError } from '../http.js';

const router = Router();
const LIMIT = 8;

router.get('/', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) throw new HttpError(400, 'BAD_REQUEST', '검색어는 2글자 이상 입력하세요.');
  if (q.length > 50) throw new HttpError(400, 'BAD_REQUEST', '검색어가 너무 깁니다.');
  const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`; // LIKE 와일드카드 이스케이프
  const [news, drivers, teams, circuits, races, posts] = await Promise.all([
    query('SELECT id, source, title, url, published_utc AS "publishedUtc" FROM news WHERE title ILIKE $1 ORDER BY published_utc DESC NULLS LAST LIMIT $2', [like, LIMIT]),
    query(`SELECT DISTINCT ON (d.id) d.id, d.code, d.name, t.name AS "teamName" FROM driver d
             LEFT JOIN entry e ON e.driver_id = d.id LEFT JOIN team t ON t.id = e.team_id
            WHERE d.name ILIKE $1 OR d.code ILIKE $1 ORDER BY d.id, e.season DESC LIMIT $2`, [like, LIMIT]),
    query('SELECT id, name FROM team WHERE name ILIKE $1 ORDER BY name LIMIT $2', [like, LIMIT]),
    query('SELECT id, name, country FROM circuit WHERE name ILIKE $1 OR country ILIKE $1 ORDER BY name LIMIT $2', [like, LIMIT]),
    query('SELECT id, season, round, name FROM race WHERE name ILIKE $1 ORDER BY season DESC, round DESC LIMIT $2', [like, LIMIT]),
    query('SELECT id, title, created_utc AS "createdUtc" FROM post WHERE title ILIKE $1 OR body ILIKE $1 ORDER BY created_utc DESC LIMIT $2', [like, LIMIT]),
  ]);
  res.json({ q, news: news.rows, drivers: drivers.rows, teams: teams.rows, circuits: circuits.rows, races: races.rows, posts: posts.rows });
});

export default router;
