// db/schema.sql을 DB에 적용한다. 실행: npm run db:schema
import { readFile } from 'node:fs/promises';
import { pool, query } from '../server/db.js';

try {
  await query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  const { rows } = await query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1",
  );
  console.log('적용 완료. 테이블:', rows.map((r) => r.table_name).join(', '));
} catch (e) {
  console.error('실패:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
