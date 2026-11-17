// 비밀번호 해시(scrypt)와 JWT(HS256) — Node 내장 crypto만 사용한다.
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';

const TOKEN_TTL_SEC = 7 * 24 * 3600;
const b64 = (x) => Buffer.from(x).toString('base64url');
const secret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET 환경 변수가 없습니다.');
  return process.env.JWT_SECRET;
};

export function hashPassword(password) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('base64url')}$${scryptSync(password, salt, 64).toString('base64url')}`;
}

export function verifyPassword(password, stored) {
  const [kind, salt, hash] = stored.split('$');
  if (kind !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64url');
  return timingSafeEqual(scryptSync(password, Buffer.from(salt, 'base64url'), expected.length), expected);
}

const sign = (data) => createHmac('sha256', secret()).update(data).digest('base64url');

export function signToken(userId) {
  const head = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC }));
  return `${head}.${body}.${sign(`${head}.${body}`)}`;
}

// 유효하면 사용자 id, 아니면 null (서명·만료 검사)
export function verifyToken(token) {
  const [head, body, sig] = String(token).split('.');
  if (!sig) return null;
  const good = Buffer.from(sign(`${head}.${body}`)), got = Buffer.from(sig);
  if (good.length !== got.length || !timingSafeEqual(good, got)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url'));
    return p.exp > Date.now() / 1000 ? p.sub : null;
  } catch { return null; }
}
