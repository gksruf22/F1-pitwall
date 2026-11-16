// 라우터 공통 도우미: 오류 응답 형식과 쿼리 파라미터 검사.
import { query } from './db.js';
import { cached } from './cache.js';

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// 양의 정수 파라미터. 값이 없으면 fallback, 형식이 틀리면 400.
export function intParam(value, name, fallback = null) {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, 'BAD_REQUEST', `${name} 값이 올바르지 않습니다.`);
  return n;
}

// season 파라미터가 없으면 DB에 있는 가장 최근 시즌.
export async function seasonParam(value) {
  const season = intParam(value, 'season');
  if (season) return season;
  const year = await cached('season:latest', 60_000, async () => {
    const { rows } = await query('SELECT max(year) AS year FROM season');
    return rows[0].year;
  });
  if (!year) throw new HttpError(404, 'NO_DATA', '수집된 시즌이 없습니다.');
  return year;
}
