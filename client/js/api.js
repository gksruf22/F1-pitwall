// 서버 API 클라이언트. 화면은 외부 F1 API를 직접 부르지 않고 항상 여기만 거친다.
export async function api(path, params = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''));
  const url = `/api${path}${qs.size ? `?${qs}` : ''}`;
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error?.message ?? `요청에 실패했습니다 (${res.status}).`);
  return body;
}

// 현재 페이지 URL의 쿼리 값 (?season=2026 등)
export const urlParam = (name) => new URLSearchParams(location.search).get(name);

export function setUrlParams(changes) {
  const p = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(changes)) (v == null ? p.delete(k) : p.set(k, v));
  location.search = p.toString();
}
