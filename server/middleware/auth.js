// JWT 검사: 통과하면 req.userId를 채운다. 게시글·댓글 수정/삭제 등 본인 확인은 이 값으로 한다.
import { HttpError } from '../http.js';
import { verifyToken } from '../services/auth.js';

export function requireAuth(req, res, next) {
  const m = /^Bearer (.+)$/.exec(req.get('authorization') ?? '');
  const userId = m && verifyToken(m[1]);
  if (!userId) throw new HttpError(401, 'UNAUTHORIZED', '로그인이 필요합니다.');
  req.userId = userId;
  next();
}
