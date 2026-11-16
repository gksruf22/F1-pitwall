// 시간은 서버가 UTC로 주고, 화면에서 한국 시간(KST)으로 바꿔 보여 준다.
const TZ = 'Asia/Seoul';
const fmt = (opts) => new Intl.DateTimeFormat('ko-KR', { timeZone: TZ, ...opts });
const dateFmt = fmt({ month: 'long', day: 'numeric', weekday: 'short' });
const shortFmt = fmt({ month: 'numeric', day: 'numeric' });
const timeFmt = fmt({ hour: '2-digit', minute: '2-digit', hour12: false });

export const kstDate = (utc) => dateFmt.format(new Date(utc));
export const kstShortDate = (utc) => shortFmt.format(new Date(utc));
export const kstTime = (utc) => timeFmt.format(new Date(utc));

// 밀리초 → 1:23.456
export function lapTime(ms) {
  if (ms == null) return '–';
  const m = Math.floor(ms / 60000);
  const sec = ((ms % 60000) / 1000).toFixed(3).padStart(6, '0');
  return `${m}:${sec}`;
}

export const SESSION_NAMES = { SQ: '스프린트 예선', S: '스프린트', Q: '예선', R: '결승' };

// 포인트는 0.5점 단위가 있어 정수면 소수점 없이 표기
export const points = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// 남은 시간(ms) → 일·시·분·초
export function parts(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(t / 86400), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}
