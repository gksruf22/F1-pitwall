// 저장된 테마를 렌더링 전에 적용한다(깜빡임 방지). 저장소를 못 쓰면 기본(다크).
try {
  const t = localStorage.getItem('theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch { /* 무시 */ }
