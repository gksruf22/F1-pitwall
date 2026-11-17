// 가입·로그인·내 정보. 비밀번호는 scrypt 해시로만 저장하고 응답에 싣지 않는다.
import { Router } from 'express';
import { query } from '../db.js';
import { HttpError } from '../http.js';
import { requireAuth } from '../middleware/auth.js';
import { hashPassword, verifyPassword, signToken } from '../services/auth.js';

const router = Router();

// 로그인 무차별 대입 방지: IP+이메일당 15분에 10회 실패까지(서버 메모리, 재시작하면 초기화)
const fails = new Map();
const WINDOW_MS = 15 * 60_000, MAX_FAILS = 10;
const recent = (k) => (fails.get(k) ?? []).filter((t) => Date.now() - t < WINDOW_MS);

const text = (v) => (typeof v === 'string' ? v.trim() : '');
const publicUser = (u) => ({ id: u.id, email: u.email, nickname: u.nickname });
const session = (u) => ({ token: signToken(u.id), user: publicUser(u) });

router.post('/register', async (req, res) => {
  const email = text(req.body?.email).toLowerCase(), nickname = text(req.body?.nickname), password = req.body?.password;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 100) throw new HttpError(400, 'BAD_REQUEST', '이메일 형식이 올바르지 않습니다.');
  if (nickname.length < 2 || nickname.length > 20) throw new HttpError(400, 'BAD_REQUEST', '닉네임은 2~20자로 입력해 주세요.');
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) throw new HttpError(400, 'BAD_REQUEST', '비밀번호는 8~72자로 입력해 주세요.');
  const { rows } = await query(
    `INSERT INTO app_user (email, nickname, pw_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING RETURNING id, email, nickname`, [email, nickname, hashPassword(password)]);
  if (!rows.length) throw new HttpError(409, 'EMAIL_TAKEN', '이미 가입된 이메일입니다.');
  res.status(201).json(session(rows[0]));
});

router.post('/login', async (req, res) => {
  const email = text(req.body?.email).toLowerCase(), password = req.body?.password;
  const k = `${req.ip}|${email}`;
  if (recent(k).length >= MAX_FAILS) throw new HttpError(429, 'TOO_MANY', '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.');
  const { rows } = await query('SELECT id, email, nickname, pw_hash FROM app_user WHERE email = $1', [email]);
  if (!rows.length || typeof password !== 'string' || !verifyPassword(password, rows[0].pw_hash)) {
    fails.set(k, [...recent(k), Date.now()]);
    throw new HttpError(401, 'BAD_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.');
  }
  fails.delete(k);
  res.json(session(rows[0]));
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT id, email, nickname FROM app_user WHERE id = $1', [req.userId]);
  if (!rows.length) throw new HttpError(401, 'UNAUTHORIZED', '로그인이 필요합니다.');
  res.json({ user: publicUser(rows[0]) });
});

export default router;
