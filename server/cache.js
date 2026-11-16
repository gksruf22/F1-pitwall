// 메모리 캐시(Map + TTL). 같은 요청이 DB(시드니 리전, 왕복 ~200ms)를 매번 치지 않게 한다.
// 수집(ingest)은 별도 프로세스라 무효화 신호가 없으므로 TTL이 지나면 새 값을 읽는 방식이다.
const store = new Map();

export async function cached(key, ttlMs, load) {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await load();
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}
