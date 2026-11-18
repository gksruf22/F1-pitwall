// 게시판: 목록·상세는 누구나, 쓰기는 로그인, 수정·삭제는 작성자 본인만.
import { Router } from 'express';
import { query } from '../db.js';
import { HttpError, intParam } from '../http.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const PAGE_SIZE = 20;

// 문자열 입력 검사(앞뒤 공백 제거 후 길이)
function text(v, name, max) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s || s.length > max) throw new HttpError(400, 'BAD_REQUEST', `${name}은(는) 1~${max}자로 입력해 주세요.`);
  return s;
}
const postInput = (b) => ({ title: text(b?.title, '제목', 100), body: text(b?.body, '본문', 5000) });

// 작성자 본인인지 확인: 없으면 404, 남의 것이면 403
async function assertOwner(table, id, userId) {
  const { rows } = await query(`SELECT user_id FROM ${table} WHERE id = $1`, [id]); // table은 고정 값만 넘긴다
  if (!rows.length) throw new HttpError(404, 'NOT_FOUND', '글을 찾을 수 없습니다.');
  if (rows[0].user_id !== userId) throw new HttpError(403, 'FORBIDDEN', '작성자만 수정·삭제할 수 있습니다.');
}

router.get('/', async (req, res) => {
  const page = intParam(req.query.page, 'page', 1);
  const { rows } = await query(
    `SELECT p.id, p.title, p.user_id AS "userId", u.nickname, p.created_utc AS "createdUtc",
            (SELECT count(*)::int FROM comment c WHERE c.post_id = p.id) AS comments, count(*) OVER()::int AS total
       FROM post p JOIN app_user u ON u.id = p.user_id
      ORDER BY p.created_utc DESC, p.id DESC LIMIT $1 OFFSET $2`, [PAGE_SIZE, (page - 1) * PAGE_SIZE]);
  const total = rows[0]?.total ?? (await query('SELECT count(*)::int AS n FROM post')).rows[0].n;
  res.json({ page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total, posts: rows.map(({ total, ...p }) => p) });
});

router.get('/:id', async (req, res) => {
  const id = intParam(req.params.id, 'id');
  const [post, comments] = await Promise.all([
    query(`SELECT p.id, p.title, p.body, p.user_id AS "userId", u.nickname, p.created_utc AS "createdUtc", p.updated_utc AS "updatedUtc"
             FROM post p JOIN app_user u ON u.id = p.user_id WHERE p.id = $1`, [id]),
    query(`SELECT c.id, c.body, c.user_id AS "userId", u.nickname, c.created_utc AS "createdUtc"
             FROM comment c JOIN app_user u ON u.id = c.user_id WHERE c.post_id = $1 ORDER BY c.created_utc, c.id`, [id]),
  ]);
  if (!post.rows.length) throw new HttpError(404, 'NOT_FOUND', '글을 찾을 수 없습니다.');
  res.json({ post: post.rows[0], comments: comments.rows });
});

router.post('/', requireAuth, async (req, res) => {
  const { title, body } = postInput(req.body);
  const { rows } = await query('INSERT INTO post (user_id, title, body) VALUES ($1, $2, $3) RETURNING id', [req.userId, title, body]);
  res.status(201).json({ id: rows[0].id });
});

router.put('/:id', requireAuth, async (req, res) => {
  const id = intParam(req.params.id, 'id');
  const { title, body } = postInput(req.body);
  await assertOwner('post', id, req.userId);
  await query('UPDATE post SET title = $1, body = $2, updated_utc = now() WHERE id = $3', [title, body, id]);
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const id = intParam(req.params.id, 'id');
  await assertOwner('post', id, req.userId);
  await query('DELETE FROM post WHERE id = $1', [id]);
  res.json({ ok: true });
});

// 댓글 작성 + 글쓴이에게 POST_COMMENT 알림(자기 글에 단 댓글은 제외)
router.post('/:id/comments', requireAuth, async (req, res) => {
  const postId = intParam(req.params.id, 'id');
  const body = text(req.body?.body, '댓글', 1000);
  const { rows } = await query(
    'INSERT INTO comment (post_id, user_id, body) SELECT id, $2, $3 FROM post WHERE id = $1 RETURNING id', [postId, req.userId, body]);
  if (!rows.length) throw new HttpError(404, 'NOT_FOUND', '글을 찾을 수 없습니다.');
  await query(
    `INSERT INTO notification (user_id, kind, ref_key, text)
     SELECT p.user_id, 'POST_COMMENT', 'comment:' || $2::int, '내 글 "' || left(p.title, 30) || '"에 새 댓글이 달렸어요'
       FROM post p WHERE p.id = $1 AND p.user_id <> $3 ON CONFLICT DO NOTHING`, [postId, rows[0].id, req.userId]);
  res.status(201).json({ id: rows[0].id });
});

router.delete('/:id/comments/:cid', requireAuth, async (req, res) => {
  const cid = intParam(req.params.cid, 'cid');
  await assertOwner('comment', cid, req.userId);
  await query('DELETE FROM comment WHERE id = $1', [cid]);
  res.json({ ok: true });
});

export default router;
