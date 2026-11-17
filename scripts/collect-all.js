// Jolpica 과거 시즌 일괄 수집(이어받기). 실행: npm run collect:all [-- --status]
// 해야 할 일(시즌별 결과·예선, 시즌별 랩·피트스톱)을 순서대로 실행하고, 끝난 일은 data/collect-state.json에 기록한다.
// 호출 한도(종료 코드 75)에 걸리면 거기서 멈추고 기록해 둔다 → 나중에 같은 명령을 다시 실행하면 이어서 받는다.
// 2026 랩은 대상이 아니다: ingest-laps가 lap·pit_stop을 지우고 다시 넣어서 OpenF1 수집값(섹터·스피드트랩·정지 시간)이 사라진다.
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const STATE_FILE = fileURLToPath(new URL('../data/collect-state.json', import.meta.url));
const RESULT_YEARS = [2013, 2012, 2011, 2010];
const LAP_YEARS = Array.from({ length: 16 }, (_, i) => 2025 - i); // 2025 → 2010
const TASKS = [
  ...RESULT_YEARS.map((y) => ({ key: `results:${y}`, script: 'scripts/ingest.js', year: y, label: `${y} 결과·예선·스프린트` })),
  ...LAP_YEARS.map((y) => ({ key: `laps:${y}`, script: 'scripts/ingest-laps.js', year: y, label: `${y} 랩·피트스톱` })),
];

// 처음 실행할 때의 기록: 이미 끝난 시즌(2014~2025 결과, 2026 결과·랩)
const INITIAL = { done: [...Array.from({ length: 12 }, (_, i) => `results:${2025 - i}`), 'results:2026', 'laps:2026'], history: [] };

const load = async () => { try { return JSON.parse(await readFile(STATE_FILE, 'utf8')); } catch { return structuredClone(INITIAL); } };
const save = async (s) => { await mkdir(new URL('../data/', import.meta.url), { recursive: true }); await writeFile(STATE_FILE, JSON.stringify(s, null, 2)); };
const now = () => new Date().toISOString();

const state = await load();
const todo = TASKS.filter((t) => !state.done.includes(t.key));

if (process.argv.includes('--status')) {
  console.log(`끝난 일 ${state.done.length}개 / 남은 일 ${todo.length}개`);
  for (const t of todo) console.log(`  - ${t.label}`);
  const last = state.history.at(-1);
  if (last) console.log(`마지막 기록: ${last.at} ${last.event}${last.task ? ` (${last.task})` : ''}`);
  process.exit(0);
}

console.log(`남은 일 ${todo.length}개`);
for (const t of todo) {
  console.log(`\n=== ${t.label} ===`);
  const { status } = spawnSync(process.execPath, [t.script, '--year', String(t.year)], { stdio: 'inherit' });
  if (status === 0) {
    state.done.push(t.key);
    state.history.push({ at: now(), event: '완료', task: t.key });
    await save(state);
  } else if (status === 75) {
    state.history.push({ at: now(), event: '호출 한도에 걸려 중단', task: t.key });
    await save(state);
    const left = TASKS.filter((x) => !state.done.includes(x.key)).length;
    console.log(`\n호출 한도에 걸려 멈췄습니다. 남은 일 ${left}개. 받은 데이터는 캐시에 있으니 시간이 지난 뒤 'npm run collect:all'을 다시 실행하세요.`);
    process.exit(0);
  } else {
    state.history.push({ at: now(), event: `실패(종료 코드 ${status})`, task: t.key });
    await save(state);
    console.error(`${t.label} 실패 — 다음 일로 넘어갑니다.`);
  }
}
const left = TASKS.filter((x) => !state.done.includes(x.key));
console.log(left.length ? `\n끝나지 않은 일 ${left.length}개: ${left.map((x) => x.key).join(', ')}` : '\n모든 수집이 끝났습니다.');
