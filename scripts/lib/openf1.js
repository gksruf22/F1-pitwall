// OpenF1 호출 모듈: 한도(초당 3회·분당 30회)를 지키려고 호출 사이 2.2초를 두고, 429·5xx는 재시도, 원본은 data/raw/openf1에 캐시한다.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://api.openf1.org/v1';
const CACHE_DIR = fileURLToPath(new URL('../../data/raw/openf1/', import.meta.url)); // pathname은 한글 경로를 %인코딩해 버린다
const GAP_MS = 2200;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastCall = 0;

/** path: 'laps', query: { session_key: 11326 }. extra: '날짜 범위 같은 미리 인코딩된 문자열'. 결과 배열 반환(캐시 우선). */
export async function openf1(endpoint, query = {}, extra = '') {
  const qs = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString() + extra;
  const file = path.join(CACHE_DIR, `${endpoint}_${qs.replace(/[^a-zA-Z0-9]+/g, '_')}.json`);
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { /* 캐시 없음 */ }

  for (let i = 1; i <= 5; i++) {
    const wait = lastCall + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    try {
      const res = await fetch(`${BASE}/${endpoint}?${qs}`, { signal: AbortSignal.timeout(90000) });
      if (res.status === 404) return []; // OpenF1은 데이터가 없으면 404
      if (res.ok) {
        const data = await res.json();
        await mkdir(CACHE_DIR, { recursive: true });
        await writeFile(file, JSON.stringify(data));
        return data;
      }
      if (res.status !== 429 && res.status < 500) throw new Error(`HTTP ${res.status}`);
      console.warn(`  재시도 ${i}/5: ${endpoint} HTTP ${res.status}`);
      await sleep(5000 * i);
    } catch (e) {
      if (e.message.startsWith('HTTP ')) throw new Error(`${e.message} ${endpoint}?${qs}`);
      console.warn(`  재시도 ${i}/5: ${endpoint} ${e.message}`);
      await sleep(5000 * i);
    }
  }
  throw new Error(`재시도 초과: ${endpoint}?${qs}`);
}
