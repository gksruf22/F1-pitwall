// 로그인 상태(토큰·사용자)와 인증이 필요한 요청. 토큰은 이 브라우저의 localStorage에만 둔다.
const KEY = 'auth';

export function getAuth() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}
export function setAuth(auth) {
  try { auth ? localStorage.setItem(KEY, JSON.stringify(auth)) : localStorage.removeItem(KEY); } catch { /* 저장 불가 시 이번 방문에만 해당 */ }
}

// JSON 요청(POST 등). 토큰이 있으면 Authorization 헤더를 붙인다. 401이면 저장된 로그인을 지운다.
export async function send(method, path, body) {
  const auth = getAuth();
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth.token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
  }
  const data = await res.json().catch(() => null);
  if (res.status === 401 && auth && path !== '/auth/login') setAuth(null);
  if (!res.ok) throw new Error(data?.error?.message ?? `요청에 실패했습니다 (${res.status}).`);
  return data;
}
