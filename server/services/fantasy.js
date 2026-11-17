// Fantasy 채점 규칙(PLAN 8-1): 자리까지 맞힌 드라이버 +3, 포디움에는 들었지만 자리가 틀리면 +1, 셋 다 자리까지 맞히면 보너스 +3.
import { query } from '../db.js';

// pick: [p1,p2,p3], podium: 실제 1~3위 [p1,p2,p3] → { score, exact }
export function scorePrediction(pick, podium) {
  let score = 0, exact = 0;
  pick.forEach((d, i) => {
    if (d === podium[i]) { score += 3; exact++; } else if (podium.includes(d)) score += 1;
  });
  if (exact === 3) score += 3;
  return { score, exact };
}

// 결승 결과가 들어왔고 아직 채점되지 않은 예측만 채점한다(여러 번 실행해도 안전, 이미 채점된 건 건드리지 않는다).
export async function scorePending() {
  const { rows } = await query(
    `SELECT fp.user_id, fp.race_id, fp.p1, fp.p2, fp.p3,
            (SELECT array_agg(r.driver_id ORDER BY r.position) FROM result r JOIN session s ON s.id = r.session_id
              WHERE s.race_id = fp.race_id AND s.type = 'R' AND r.position BETWEEN 1 AND 3) AS podium
       FROM fantasy_prediction fp WHERE fp.score IS NULL`);
  for (const p of rows) {
    if (p.podium?.length !== 3) continue; // 결과가 아직 없거나 불완전
    const { score, exact } = scorePrediction([p.p1, p.p2, p.p3], p.podium);
    await query('UPDATE fantasy_prediction SET score = $1, exact = $2 WHERE user_id = $3 AND race_id = $4 AND score IS NULL', [score, exact, p.user_id, p.race_id]);
  }
}
