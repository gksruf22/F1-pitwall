// 알림 생성 작업: "아직 안 만든 알림만" 만든다(ON CONFLICT DO NOTHING이라 여러 번 실행해도 안전).
// 결과가 오래된 레이스는 제외해(최근 14일) 새 즐겨찾기가 옛 알림을 쏟아내지 않게 한다.
import { query } from '../db.js';
import { scorePending } from './fantasy.js';

const RECENT = `s.start_utc < now() AND s.start_utc > now() - interval '14 days'`;
const INSERT = 'INSERT INTO notification (user_id, kind, ref_key, text)';
const JOBS = [
  // 즐겨찾기 드라이버의 결승 결과
  `${INSERT}
   SELECT f.user_id, 'FAV_RESULT', 'race:' || ra.id || ':driver:' || d.id,
          d.name || ' 드라이버가 ' || ra.name || '에서 ' || CASE
            WHEN r.position = 1 THEN '우승'
            WHEN r.position <= 3 THEN r.position || '위로 포디움'
            WHEN r.points > 0 THEN r.position || '위로 포인트 획득'
            WHEN r.status ~ '^(Finished|\\+)' THEN r.position || '위로 완주'
            ELSE '리타이어(' || COALESCE(r.status, '') || ')' END
     FROM favorite f JOIN driver d ON f.kind = 'driver' AND d.id = f.ref_id
     JOIN result r ON r.driver_id = d.id JOIN session s ON s.id = r.session_id AND s.type = 'R'
     JOIN race ra ON ra.id = s.race_id
    WHERE ${RECENT} AND r.position IS NOT NULL
   ON CONFLICT DO NOTHING`,
  // 즐겨찾기 팀의 결승 포인트
  `${INSERT}
   SELECT f.user_id, 'FAV_RESULT', 'race:' || ra.id || ':team:' || t.id,
          t.name || ' 팀이 ' || ra.name || '에서 ' || regexp_replace(sum(r.points)::text, '\\.0+$', '') || '점 획득'
     FROM favorite f JOIN team t ON f.kind = 'team' AND t.id = f.ref_id
     JOIN result r ON r.team_id = t.id JOIN session s ON s.id = r.session_id AND s.type = 'R'
     JOIN race ra ON ra.id = s.race_id
    WHERE ${RECENT}
    GROUP BY f.user_id, ra.id, ra.name, t.id, t.name HAVING sum(r.points) > 0
   ON CONFLICT DO NOTHING`,
  // 즐겨찾기 드라이버의 폴 포지션(예선 1위)
  `${INSERT}
   SELECT f.user_id, 'FAV_POLE', 'race:' || ra.id || ':pole', d.name || ' 폴 포지션 획득 (' || ra.name || ')'
     FROM favorite f JOIN driver d ON f.kind = 'driver' AND d.id = f.ref_id
     JOIN result r ON r.driver_id = d.id AND r.position = 1 JOIN session s ON s.id = r.session_id AND s.type = 'Q'
     JOIN race ra ON ra.id = s.race_id
    WHERE ${RECENT}
   ON CONFLICT DO NOTHING`,
  // 곧 시작하는 그랑프리(결승 24시간 이내) — 로그인 사용자 전체
  `${INSERT}
   SELECT u.id, 'RACE_SOON', 'race:' || ra.id || ':d1', '24시간 안에 ' || ra.name || '이(가) 시작합니다'
     FROM app_user u CROSS JOIN race ra JOIN session s ON s.race_id = ra.id AND s.type = 'R'
    WHERE s.start_utc > now() AND s.start_utc <= now() + interval '24 hours'
   ON CONFLICT DO NOTHING`,
  // Fantasy 채점 결과
  `${INSERT}
   SELECT fp.user_id, 'FANTASY_SCORED', 'race:' || fp.race_id || ':fantasy',
          ra.name || ' 예측 점수 ' || fp.score || '점 (자리 ' || fp.exact || '개 적중)'
     FROM fantasy_prediction fp JOIN race ra ON ra.id = fp.race_id WHERE fp.score IS NOT NULL
   ON CONFLICT DO NOTHING`,
];

export async function createNotifications() {
  await scorePending(); // 채점이 먼저 끝나 있어야 FANTASY_SCORED가 만들어진다
  for (const sql of JOBS) await query(sql);
}

// 서버가 켜져 있는 동안 10분마다(시작 시 1회 포함). 실패해도 서버는 계속 돈다.
export function scheduleNotifications() {
  const run = () => createNotifications().catch((e) => console.error('알림 생성 실패:', e.message));
  run();
  setInterval(run, 10 * 60_000).unref();
}
