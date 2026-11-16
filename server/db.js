// DB 연결 공통 모듈: 모든 쿼리는 이 pool을 거친다. SQL은 항상 $1 파라미터 바인딩으로 작성한다.
import 'dotenv/config';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL이 없습니다. .env.example을 .env로 복사해 값을 채우세요.');
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase는 SSL 필수
  max: 5,
});

export const query = (text, params) => pool.query(text, params);
