// Jolpica(Ergast 호환) 호출 모듈: 호출 간격 유지 + 재시도 + data/raw 원본 캐시.
// 한도: 초당 4회·시간당 500회 안팎 → 호출 사이 400ms를 둔다. 캐시가 있으면 호출하지 않는다.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://api.jolpi.ca/ergast/f1';
const CACHE_DIR = fileURLToPath(new URL('../../data/raw/jolpica/', import.meta.url)); // pathname은 한글 경로를 %인코딩해 버린다
const GAP_MS = 400;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastCall = 0;

async function fetchJson(url, tries = 4) {
  for (let i = 1; i <= tries; i++) {
    const wait = lastCall + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      if (res.status !== 429 && res.status < 500) throw new Error(`HTTP ${res.status}`); // 재시도 무의미
      const retryAfter = Number(res.headers.get('retry-after')) || 0;
      console.warn(`  재시도 ${i}/${tries}: HTTP ${res.status} (retry-after ${retryAfter}s)`);
      await sleep(Math.max(retryAfter * 1000, 2000 * i));
    } catch (e) {
      if (e.message.startsWith('HTTP ')) throw new Error(`${e.message} ${url}`);
      await sleep(2000 * i); // 네트워크 오류는 재시도
    }
  }
  throw new Error(`재시도 초과: ${url}`);
}

/**
 * 시즌 경로(`/2026/1/results`)를 가져와 MRData를 돌려준다. 원본은 data/raw에 저장한다.
 * - 이미 저장돼 있으면 호출하지 않는다(이어받기). refresh면 무시한다.
 * - 아직 결과가 없는 응답(Races 빈 배열)은 저장하지 않는다 → 나중에 다시 받는다.
 */
export async function getJolpica(route, { refresh = false } = {}) {
  const file = path.join(CACHE_DIR, `${route.replace(/\//g, '_')}.json`);
  if (!refresh) {
    try {
      return JSON.parse(await readFile(file, 'utf8'));
    } catch {
      /* 캐시 없음 */
    }
  }
  const data = (await fetchJson(`${BASE}/${route}.json?limit=100`)).MRData;
  const hasData = (data.RaceTable?.Races?.length ?? 0) > 0;
  if (hasData) {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(file, JSON.stringify(data));
  }
  return data;
}

// "1:22.670" → 82670, "22.670" → 22670, 없으면 null
export function toMs(time) {
  if (!time) return null;
  const m = /^(?:(\d+):)?(\d+)\.(\d{3})$/.exec(time);
  return m ? Number(m[1] ?? 0) * 60000 + Number(m[2]) * 1000 + Number(m[3]) : null;
}
