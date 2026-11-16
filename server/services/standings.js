// 순위 계산: 별도 순위 테이블 없이 result(결승 R + 스프린트 S)의 포인트를 합산한다.
// 순위 동률은 포인트 → 우승 횟수 → 이름 순(공식 규정의 상세 카운트백은 단순화).
import { query } from '../db.js';
import { cached } from '../cache.js';

const TTL = 60_000;

// 라운드별 포인트 행(드라이버·팀 정보 포함). 시즌 단위로 한 번만 읽어 순위·변동·차트에 모두 쓴다.
async function loadRows(season) {
  const { rows } = await query(
    `SELECT ra.round, r.driver_id, d.code, d.name AS driver_name,
            r.team_id, t.name AS team_name, t.color,
            sum(r.points)::float AS points,
            count(*) FILTER (WHERE s.type = 'R' AND r.position = 1)::int AS wins
       FROM result r
       JOIN session s ON s.id = r.session_id
       JOIN race ra ON ra.id = s.race_id
       JOIN driver d ON d.id = r.driver_id
       LEFT JOIN team t ON t.id = r.team_id
      WHERE ra.season = $1 AND s.type IN ('R', 'S')
      GROUP BY ra.round, r.driver_id, d.code, d.name, r.team_id, t.name, t.color`,
    [season],
  );
  return rows;
}

// 1~upTo 라운드 누적 순위. key: 'driver' | 'constructor'
function rank(rows, upTo, kind) {
  const idOf = (r) => (kind === 'driver' ? r.driver_id : r.team_id);
  const map = new Map();
  for (const r of rows) {
    if (r.round > upTo || !idOf(r)) continue;
    let e = map.get(idOf(r));
    if (!e) {
      e = kind === 'driver'
        ? { id: r.driver_id, code: r.code, name: r.driver_name, points: 0, wins: 0, lastRound: 0 }
        : { id: r.team_id, name: r.team_name, points: 0, wins: 0 };
      map.set(e.id, e);
    }
    e.points += r.points;
    e.wins += r.wins;
    // 드라이버의 소속은 가장 최근 라운드 기준(시즌 중 이적 대비)
    if (kind === 'driver' && r.round >= e.lastRound) {
      e.lastRound = r.round;
      e.teamId = r.team_id;
      e.teamName = r.team_name;
      e.color = r.color;
    }
    if (kind === 'constructor') e.color = r.color;
  }
  const list = [...map.values()].sort(
    (a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name),
  );
  list.forEach((e, i) => { e.position = i + 1; delete e.lastRound; });
  return list;
}

// season의 kind 순위. round가 없으면 결과가 있는 마지막 라운드까지.
export function getStandings(season, kind, round) {
  return cached(`standings:${season}:${kind}:${round ?? 'latest'}`, TTL, async () => {
    const rows = await loadRows(season);
    const rounds = [...new Set(rows.map((r) => r.round))].sort((a, b) => a - b);
    const upTo = round ?? rounds.at(-1) ?? 0;
    const current = rank(rows, upTo, kind);
    const prevPos = new Map(rank(rows, upTo - 1, kind).map((e) => [e.id, e.position]));
    const leader = current[0]?.points ?? 0;
    const standings = current.map((e) => ({
      ...e,
      gapToLeader: leader - e.points,
      // 양수 = 순위 상승(▲). 첫 라운드이거나 직전에 순위에 없던 경우 null
      change: prevPos.has(e.id) && e.points > 0 ? prevPos.get(e.id) - e.position : null, // 0점 동률끼리의 이름순 변동은 표시하지 않음
    }));
    // 누적 포인트 추이(차트용): 상위 순서대로 라운드별 누적값
    const history = current.map((e) => {
      let sum = 0;
      return {
        id: e.id,
        code: e.code,
        name: e.name,
        color: e.color,
        points: rounds.filter((n) => n <= upTo).map((n) => {
          sum += rows.filter((r) => r.round === n && (kind === 'driver' ? r.driver_id : r.team_id) === e.id)
            .reduce((a, r) => a + r.points, 0);
          return sum;
        }),
      };
    });
    return { season, round: upTo, rounds: rounds.filter((n) => n <= upTo), standings, history };
  });
}
