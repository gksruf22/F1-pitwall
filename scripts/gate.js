// 확인 게이트: Jolpica·OpenF1 실제 응답으로 필드 존재 여부를 확인한다. (docs/data-gate.md 참고)
// 실행: npm run gate   — 외부 라이브러리 없이 Node 내장 fetch만 사용한다.
const JOLPICA = 'https://api.jolpi.ca/ergast/f1';
const OPENF1 = 'https://api.openf1.org/v1';
const SEASON = 2026;
const ROUND = 1; // Jolpica 확인용 라운드
const OPENF1_RACE = 11326; // 2026 실버스톤 (세이프티카·VSC 있음, 위치 데이터 있음)
const OPENF1_SQ = 11236; // 2026 상하이 스프린트 예선

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 호출 한도(OpenF1 초당 3회) 안에서 요청하고, 일시 오류는 재시도한다.
async function get(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    await sleep(500);
    try {
      const res = await fetch(url);
      if (res.status === 404) return { status: 404, data: [] }; // OpenF1: 결과 없음
      if (res.ok) return { status: res.status, data: await res.json() };
      if (res.status !== 429 && res.status < 500) return { status: res.status, data: null };
    } catch {
      /* 네트워크 오류는 재시도 */
    }
    await sleep(1000 * i);
  }
  return { status: 0, data: null };
}

const results = [];
function check(name, ok, detail = '') {
  results.push(ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
}

// --- Jolpica ---
const races = await get(`${JOLPICA}/${SEASON}/races.json?limit=100`);
const raceList = races.data?.MRData?.RaceTable?.Races ?? [];
check('Jolpica 시즌 일정', raceList.length > 0, `${raceList.length}라운드`);
check('세션 시작 시각(Qualifying)', !!raceList[0]?.Qualifying?.time);

const quali = await get(`${JOLPICA}/${SEASON}/${ROUND}/qualifying.json?limit=3`);
const q = quali.data?.MRData?.RaceTable?.Races?.[0]?.QualifyingResults?.[0];
check('예선 Q1/Q2/Q3 시간', !!(q?.Q1 && q?.Q2 && q?.Q3), `${q?.Q1} / ${q?.Q2} / ${q?.Q3}`);

const laps = await get(`${JOLPICA}/${SEASON}/${ROUND}/laps.json?limit=100`);
const t = laps.data?.MRData?.RaceTable?.Races?.[0]?.Laps?.[0]?.Timings?.[0];
check('랩별 랩타임·포지션', !!(t?.time && t?.position), `총 ${laps.data?.MRData?.total}행(페이지당 100)`);

const pit = await get(`${JOLPICA}/${SEASON}/${ROUND}/pitstops.json?limit=3`);
const p = pit.data?.MRData?.RaceTable?.Races?.[0]?.PitStops?.[0];
check('피트스톱 duration(피트레인 통과 시간)', !!p?.duration, `${p?.duration}초`);

const sq = await get(`${JOLPICA}/${SEASON}/2/sprintqualifying.json`);
check('Jolpica 스프린트 예선 (없음이 정상)', sq.status === 400, `HTTP ${sq.status}`);

const seasons = await get(`${JOLPICA}/drivers/antonelli/seasons.json`);
const sl = seasons.data?.MRData?.SeasonTable?.Seasons ?? [];
check('드라이버 출전 시즌(루키 판별)', sl.length > 0, sl.map((s) => s.season).join(','));

// --- OpenF1 ---
const lap = await get(`${OPENF1}/laps?session_key=${OPENF1_RACE}&driver_number=12`);
check('OpenF1 스피드트랩(st_speed)', lap.data?.some((l) => l.st_speed != null), `${lap.data?.length}랩`);

const stints = await get(`${OPENF1}/stints?session_key=${OPENF1_RACE}`);
check('OpenF1 타이어 스틴트', stints.data?.[0]?.compound != null, `${stints.data?.length}행`);

const pits = await get(`${OPENF1}/pit?session_key=${OPENF1_RACE}`);
check('OpenF1 피트 정지 시간(stop_duration)', pits.data?.[0]?.stop_duration != null);

const sc = await get(`${OPENF1}/race_control?session_key=${OPENF1_RACE}&category=SafetyCar`);
check('OpenF1 세이프티카 메시지', sc.data?.length > 0, `${sc.data?.length}건`);

const sqr = await get(`${OPENF1}/session_result?session_key=${OPENF1_SQ}`);
check('OpenF1 스프린트 예선 [Q1,Q2,Q3]', Array.isArray(sqr.data?.[0]?.duration), JSON.stringify(sqr.data?.[0]?.duration));

// 레이스 시작 30분 뒤 30초 구간 (위치 데이터는 세션마다 있을 수도, 없을 수도 있다 — 모나코·사키르·제다는 없음)
const sess = await get(`${OPENF1}/sessions?session_key=${OPENF1_RACE}`);
const from = new Date(new Date(sess.data?.[0]?.date_start).getTime() + 30 * 60e3);
const iso = (d) => d.toISOString().slice(0, 19);
const loc = await get(
  `${OPENF1}/location?session_key=${OPENF1_RACE}&driver_number=12&date%3E${iso(from)}&date%3C${iso(new Date(from.getTime() + 30e3))}`,
);
check('OpenF1 위치(x,y) 샘플링', loc.data?.length > 0, `30초에 ${loc.data?.length}행`);

console.log(`\n${results.filter(Boolean).length}/${results.length} 통과`);
process.exitCode = results.every(Boolean) ? 0 : 1;
