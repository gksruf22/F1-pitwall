// Express 서버 진입점: 정적 화면(client/)과 JSON API를 한 서버에서 제공한다.
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import health from './routes/health.js';
import races from './routes/races.js';
import standings from './routes/standings.js';
import summary from './routes/summary.js';

const app = express();
const clientDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../client');

app.use(express.json());
app.use('/api/health', health);
app.use('/api/standings', standings);
app.use('/api/summary', summary);
app.use('/api', races); // /seasons, /races ...

// 존재하지 않는 API 경로는 일관된 오류 형식으로 응답한다.
app.use('/api', (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: '존재하지 않는 API입니다.' } });
});

app.use(express.static(clientDir));

// 처리하지 못한 오류는 여기서 한 번에 응답한다(상세 내용은 로그에만 남긴다).
app.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: '서버 오류가 발생했습니다.' } });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`F1 PITWALL 서버: http://localhost:${port}`));
