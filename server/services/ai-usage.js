// AI 하루 사용 횟수(ai_usage). key = 'user:<id>' | 'ip:<주소>' | 'report:<id>' | 'all'(서버 전체)
import { query } from '../db.js';
import { HttpError } from '../http.js';

export const LIMIT_ALL = 200; // 서버 전체 하루(비용 보호)

// 하루 사용 횟수를 1 올리고 올린 뒤 값을 돌려준다(UTC 날짜 기준)
export async function bump(key) {
  const { rows } = await query(
    `INSERT INTO ai_usage (key, day, count) VALUES ($1, (now() AT TIME ZONE 'UTC')::date, 1)
     ON CONFLICT (key, day) DO UPDATE SET count = ai_usage.count + 1 RETURNING count`,
    [key],
  );
  return rows[0].count;
}

export async function bumpGlobal() {
  if ((await bump('all')) > LIMIT_ALL) throw new HttpError(429, 'AI_LIMIT', '오늘 서비스 전체 AI 한도를 초과했습니다. 내일 다시 이용해 주세요.');
}
