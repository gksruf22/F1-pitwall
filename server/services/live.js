// 라이브(시뮬레이션) 타임라인: 수집된 과거 레이스의 랩·스틴트·이벤트로 "t 시점의 순위표"를 계산한다.
// 기준 시계: 레이스 시작 시각 S는 FASTEST_LAP 이벤트 시각 − 그 랩까지의 누적 랩타임의 중앙값(모든 드라이버가 같은 S로 수렴함).
// 순위 = 완료 랩 수 내림차순 → 그 랩 통과 시각 오름차순(라인 통과 순서). 갭은 마지막 라인 통과 기준.
import { query } from '../db.js';
import { cached } from '../cache.js';

const median = (v) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

export async function getTimeline(raceId) {
  return cached(`timeline:${raceId}`, 600_000, async () => {
    const { rows: [ses] } = await query(
      `SELECT s.id, s.start_utc AS "startUtc", ra.name, ra.round FROM session s JOIN race ra ON ra.id = s.race_id
        WHERE s.race_id = $1 AND s.type = 'R' AND s.openf1_key IS NOT NULL`, [raceId]);
    if (!ses) return null;
    const [{ rows: people }, { rows: laps }, { rows: stints }, { rows: events }] = await Promise.all([
      query(`SELECT d.id, d.code, d.name, t.id AS "teamId", t.color, r.grid, r.status
               FROM result r JOIN driver d ON d.id = r.driver_id LEFT JOIN team t ON t.id = r.team_id
              WHERE r.session_id = $1`, [ses.id]),
      query('SELECT driver_id AS id, lap, time_ms AS ms FROM lap WHERE session_id = $1 ORDER BY lap', [ses.id]),
      query('SELECT driver_id AS id, lap_from AS "from", lap_to AS "to", compound FROM stint WHERE session_id = $1 ORDER BY no', [ses.id]),
      query(`SELECT ts, lap, type, driver, data FROM replay_event WHERE session_id = $1 AND type <> 'POSITION_CHANGE' ORDER BY seq`, [ses.id]),
    ]);

    const drivers = people.map((p) => {
      const mine = laps.filter((l) => l.id === p.id);
      let last = 0, sum = 0;
      const cum = [0], times = [null];
      for (const l of mine) {
        const ms = l.ms ?? last; // 시간이 빠진 랩은 직전 랩 값으로 메운다
        last = ms; sum += ms; times.push(l.ms); cum.push(sum);
      }
      return {
        id: p.id, code: p.code, name: p.name, teamId: p.teamId, color: p.color, grid: p.grid || null,
        classified: p.status === 'Finished' || p.status === 'Lapped',
        cum, times, stints: stints.filter((s) => s.id === p.id),
      };
    }).filter((d) => d.cum.length > 1);

    const byCode = new Map(drivers.map((d) => [d.code, d]));
    const offsets = events.filter((e) => e.type === 'FASTEST_LAP' && byCode.get(e.driver)?.cum[e.lap] != null)
      .map((e) => new Date(e.ts).getTime() - byCode.get(e.driver).cum[e.lap]);
    if (!offsets.length) return null;
    const startMs = median(offsets);

    const feed = events.map((e) => ({ t: new Date(e.ts).getTime() - startMs, lap: e.lap, type: e.type, driver: e.driver, data: e.data }))
      .filter((e) => e.t >= 0).sort((a, b) => a.t - b.t); // seq가 시간순이 아닐 수 있다
    const totalLaps = Math.max(...drivers.map((d) => d.cum.length - 1));
    const endMs = Math.max(...drivers.map((d) => d.cum.at(-1)));
    // offsetMs: 세션 시작(위치 파일의 0)부터 레이스 시작(타임라인의 0)까지
    return { sessionId: ses.id, name: ses.name, round: ses.round, totalLaps, endMs, offsetMs: startMs - new Date(ses.startUtc).getTime(), drivers, events: feed };
  });
}

// 이벤트 → 세션 상태. SC/VSC는 DEPLOYED 때 켜지고 IN THIS LAP/ENDING 때 풀린다.
export function stateAt(tl, t) {
  let state = 'GREEN';
  for (const e of tl.events) {
    if (e.t > t) break;
    if (e.type === 'RED_FLAG') state = 'RED';
    else if (e.type === 'GREEN_FLAG') state = 'GREEN';
    else if (e.type === 'SAFETY_CAR') state = e.data?.state === 'DEPLOYED' && /DEPLOYED/.test(e.data?.message ?? 'DEPLOYED') ? (e.data.kind === 'VSC' ? 'VSC' : 'SC') : 'GREEN';
  }
  return state;
}

export function boardAt(tl, t) {
  const rows = tl.drivers.map((d) => {
    let n = 0;
    while (n + 1 < d.cum.length && d.cum[n + 1] <= t) n++;
    return { d, n };
  });
  rows.sort((a, b) => b.n - a.n || (a.n ? a.d.cum[a.n] - b.d.cum[b.n] : (a.d.grid ?? 99) - (b.d.grid ?? 99)));
  const lead = rows[0];
  let best = Infinity;
  const own = new Map();
  for (const { d, n } of rows) {
    const mine = d.times.slice(1, n + 1).filter((x) => x != null);
    own.set(d.code, mine.length ? Math.min(...mine) : null);
    if (own.get(d.code) != null) best = Math.min(best, own.get(d.code));
  }
  let prev = null;
  const board = rows.map(({ d, n }, i) => {
    let down = 0, gapMs = null;
    if (n > 0 && i > 0) {
      while (lead.d.cum[n + down + 1] != null && lead.d.cum[n + down + 1] <= d.cum[n]) down++;
      if (!down) gapMs = d.cum[n] - lead.d.cum[n];
    }
    const sameLap = prev && prev.n === n && prev.down === down;
    const intervalMs = gapMs != null && sameLap && prev.gapMs != null ? gapMs - prev.gapMs : (gapMs != null && i === 1 ? gapMs : null);
    prev = { n, down, gapMs: i === 0 ? 0 : gapMs };
    const cur = d.stints.find((s) => s.from <= n + 1 && n + 1 <= s.to) ?? d.stints.at(-1);
    const finished = t >= d.cum.at(-1) && n === d.cum.length - 1;
    return {
      pos: i + 1, code: d.code, name: d.name, teamId: d.teamId, color: d.color, grid: d.grid, laps: n,
      gapMs, lapsDown: down, intervalMs, lastMs: n ? d.times[n] : null, bestMs: own.get(d.code), overallBest: own.get(d.code) === best,
      tyre: cur?.compound ?? null, pits: Math.max(0, d.stints.filter((s) => s.from <= n + 1).length - 1),
      out: !d.classified && finished && t > d.cum.at(-1) + 90_000,
    };
  });
  return { leaderLap: Math.min(tl.totalLaps, lead.n + 1), board };
}
