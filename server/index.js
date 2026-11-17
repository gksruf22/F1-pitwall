// Express 서버 진입점: 정적 화면(client/)과 JSON API를 한 서버에서 제공한다.
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import health from './routes/health.js';
import races from './routes/races.js';
import standings from './routes/standings.js';
import summary from './routes/summary.js';
import profiles from './routes/profiles.js';
import analysis from './routes/analysis.js';
import news from './routes/news.js';
import search from './routes/search.js';
import highlights from './routes/highlights.js';
import raceAnalysis from './routes/race-analysis.js';
import live from './routes/live.js';
import auth from './routes/auth.js';
import favorites from './routes/favorites.js';
import { scheduleNews } from './services/news.js';

const app = express();
const clientDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../client');

app.use(express.json());
app.use('/api/health', health);
app.use('/api/auth', auth);
app.use('/api/favorites', favorites);
app.use('/api/standings', standings);
app.use('/api/summary', summary);
app.use('/api', races); // /seasons, /races ...
app.use('/api', raceAnalysis); // /races/:id/pace
app.use('/api', live); // /races/:id/stream (SSE)
app.use('/api/analysis', analysis);
app.use('/api/news', news);
app.use('/api/search', search);
app.use('/api/highlights', highlights);
app.use('/api', profiles); // /drivers, /teams, /circuits

// 존재하지 않는 API 경로는 일관된 오류 형식으로 응답한다.
app.use('/api', (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: '존재하지 않는 API입니다.' } });
});

// 리플레이 위치 샘플(대용량 JSON)은 DB가 아니라 파일로 정적 서빙한다.
app.use('/data/replay', express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), '../data/replay')));
app.use(express.static(clientDir));

// 처리하지 못한 오류는 여기서 한 번에 응답한다(상세 내용은 로그에만 남긴다).
app.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: '서버 오류가 발생했습니다.' } });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`F1 PITWALL 서버: http://localhost:${port}`);
  scheduleNews(); // 뉴스 RSS: 시작 시 + 하루 1회
});
