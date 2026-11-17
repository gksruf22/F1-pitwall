// 라이브 시뮬레이션 SSE: GET /api/races/:id/stream?speed=&start=
// 과거 레이스를 speed배속으로 1초마다 순위표(tick)와 이벤트(race-event)로 송출한다. 실제 실시간 데이터가 아니다.
import { Router } from 'express';
import { HttpError, intParam } from '../http.js';
import { getTimeline, boardAt, stateAt } from '../services/live.js';

const router = Router();
const SPEEDS = [1, 10, 30, 60, 120];

router.get('/races/:id/stream', async (req, res) => {
  const id = intParam(req.params.id, 'id');
  const speed = intParam(req.query.speed, 'speed', 30);
  if (!SPEEDS.includes(speed)) throw new HttpError(400, 'BAD_REQUEST', `speed는 ${SPEEDS.join(', ')} 중 하나여야 합니다.`);
  const tl = await getTimeline(id);
  if (!tl) throw new HttpError(404, 'NOT_FOUND', '라이브 시뮬레이션 데이터가 수집된 레이스가 아닙니다.');
  let t = Math.min(Math.max(0, Number(req.query.start) || 0) * 1000, tl.endMs);

  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send('hello', { raceName: tl.name, round: tl.round, totalLaps: tl.totalLaps, endMs: tl.endMs, speed, simulated: true });

  let prev = t > 0 ? t : -1; // 이벤트는 (prev, t] 구간만 보낸다. 처음에는 t=0 이벤트까지 포함.
  const tick = () => {
    const done = t >= tl.endMs;
    const { leaderLap, board } = boardAt(tl, t);
    send('tick', { t, lap: leaderLap, state: done ? 'FINISHED' : stateAt(tl, t), board });
    for (const e of tl.events) if (e.t > prev && e.t <= t) send('race-event', e);
    prev = t;
    if (done) { send('end', { t }); clearInterval(timer); res.end(); return; }
    t = Math.min(t + speed * 1000, tl.endMs);
  };
  const timer = setInterval(tick, 1000);
  req.on('close', () => clearInterval(timer));
  tick();
});

export default router;
