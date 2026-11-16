// 하이라이트: 결과 데이터에서 규칙으로 사실(폴투윈·연승·팀 1-2·최다 상승·선두 교체)만 뽑는다.
// 문장은 템플릿이고 숫자는 전부 DB 값이다. (AI는 4주차에 문장만 다듬는다 — 숫자는 만들지 않는다.)
import { query } from '../db.js';
import { cached } from '../cache.js';
import { getStandings } from './standings.js';

const classified = (s) => s === 'Finished' || s === 'Lapped';

export function getHighlights(season) {
  return cached(`highlights:${season}`, 60_000, async () => {
    const [{ rows }, { history }, { rows: races }] = await Promise.all([
      query(
        `SELECT ra.round, ra.id AS "raceId", ra.name AS "raceName", s.type, r.position, r.grid, r.status,
                d.id AS "driverId", d.name AS "driverName", t.id AS "teamId", t.name AS "teamName"
           FROM result r JOIN session s ON s.id = r.session_id JOIN race ra ON ra.id = s.race_id
           JOIN driver d ON d.id = r.driver_id LEFT JOIN team t ON t.id = r.team_id
          WHERE ra.season = $1 AND s.type IN ('R', 'Q') ORDER BY ra.round`,
        [season],
      ),
      getStandings(season, 'driver'),
      query('SELECT id, round, name FROM race WHERE season = $1 ORDER BY round', [season]),
    ]);
    const out = [];
    const winStreak = new Map(), podStreak = new Map();
    const lastRaced = Math.max(0, ...rows.filter((r) => r.type === 'R').map((r) => r.round));
    const add = (race, kind, text) => out.push({ id: `${race.round}-${out.length}`, round: race.round, raceId: race.id, raceName: race.name, kind, text });

    races.forEach((race, idx) => {
      const R = rows.filter((r) => r.round === race.round && r.type === 'R' && r.position).sort((a, b) => a.position - b.position);
      if (!R.length) return; // 아직 열리지 않은 레이스
      const pole = rows.find((r) => r.round === race.round && r.type === 'Q' && r.position === 1);
      const [w, p2] = R;

      if (pole && pole.driverId === w.driverId) add(race, 'driver', `${w.driverName}, 폴포지션에서 출발해 ${race.name} 우승 (폴투윈)`);
      if (p2 && w.teamId && w.teamId === p2.teamId) add(race, 'team', `${w.teamName}, ${race.name}에서 1-2 피니시 (${w.driverName}·${p2.driverName})`);

      const climb = R.filter((r) => classified(r.status) && r.grid > 0).map((r) => ({ ...r, up: r.grid - r.position })).sort((a, b) => b.up - a.up)[0];
      if (climb && climb.up >= 5) add(race, 'race', `${climb.driverName}, ${race.name}에서 ${climb.grid}번 그리드 → ${climb.position}위 (${climb.up}계단 상승)`);

      // 연속 기록: 이 레이스까지 이어진 연승(2+)·연속 포디움(3+)
      for (const r of R) {
        winStreak.set(r.driverId, r.position === 1 ? (winStreak.get(r.driverId) ?? 0) + 1 : 0);
        podStreak.set(r.driverId, r.position <= 3 && classified(r.status) ? (podStreak.get(r.driverId) ?? 0) + 1 : 0);
        // 같은 기록이 매 라운드 반복되지 않게, 기록이 시작되는 시점(연승 2, 포디움 3)과 가장 최근 레이스에서만 알린다.
        const wins = winStreak.get(r.driverId), pods = podStreak.get(r.driverId), latest = race.round === lastRaced;
        if (wins >= 2 && (wins === 2 || latest)) add(race, 'driver', `${r.driverName}, ${wins}연승`);
        else if (pods >= 3 && (pods === 3 || latest)) add(race, 'driver', `${r.driverName}, ${pods}경기 연속 포디움`);
      }

      // 챔피언십 선두 교체: 누적 포인트 history에서 라운드별 선두를 비교
      const leaderAt = (i) => history.reduce((best, h) => (h.points[i] > (best?.points[i] ?? -1) ? h : best), null);
      if (idx > 0 && history[0]?.points[idx] != null) {
        const now = leaderAt(idx), before = leaderAt(idx - 1);
        if (now && before && now.id !== before.id) add(race, 'driver', `${now.name}, 챔피언십 선두 교체 (${now.points[idx]}점)`);
      }
    });
    return out.sort((a, b) => b.round - a.round);
  });
}
