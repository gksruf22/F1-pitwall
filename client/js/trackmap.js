// Canvas 트랙맵 공용 모듈(리플레이·라이브 공유). 위치 파일(pos)의 전 드라이버 궤적을 곡선으로 겹쳐 서킷 윤곽을 만들고,
// draw(fileT)로 그 시각의 드라이버 위치(2초 샘플 선형 보간)를 점으로 그린다. fileT = 위치 파일 시간(ms).
import { h } from './dom.js';
import { teamColor } from './teams.js';

// drivers: [{ code, teamId, color }], opts: { labels: 코드 라벨 표시, dot: 점 반지름, maxHeight }
export function trackMap(pos, drivers, { labels = true, dot = 5.5, maxHeight = 640 } = {}) {
  const meta = new Map(drivers.map((d) => [d.code, d]));
  const codes = Object.keys(pos.drivers).filter((c) => meta.has(c));
  const T = pos.drivers[codes[0]].map((p) => p[0]); // 모든 드라이버가 같은 시각 배열을 공유한다
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const c of codes) for (const p of pos.drivers[c]) { x0 = Math.min(x0, p[1]); x1 = Math.max(x1, p[1]); y0 = Math.min(y0, p[2]); y1 = Math.max(y1, p[2]); }

  const canvas = h('canvas', { class: 'track', 'aria-label': '트랙맵' });
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, scale = 1, ox = 0, oy = 0, bg = null, lastArgs = [0, null];
  const tx = (x) => ox + (x - x0) * scale, ty = (y) => oy + (y1 - y) * scale; // y축 뒤집기
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // 캔버스가 DOM에 붙어 폭이 정해진 뒤(또는 크기·테마가 바뀔 때) 호출한다.
  function layout() {
    const dpr = window.devicePixelRatio || 1;
    W = canvas.clientWidth; H = Math.min(Math.round(W * 0.72), maxHeight);
    canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pad = 20;
    scale = Math.min((W - pad * 2) / (x1 - x0), (H - pad * 2) / (y1 - y0));
    ox = (W - (x1 - x0) * scale) / 2; oy = (H - (y1 - y0) * scale) / 2;
    bg = document.createElement('canvas'); bg.width = canvas.width; bg.height = canvas.height;
    const b = bg.getContext('2d');
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    b.lineWidth = Math.max(5, Math.min(9, W / 110)); b.lineCap = 'round'; b.lineJoin = 'round'; b.strokeStyle = css('--border') || '#333';
    for (const c of codes) {
      // 샘플 간격이 약 160m라 직선으로 이으면 코너가 잘린다 → 중간점을 지나는 2차 곡선으로 잇는다.
      let prev = null;
      b.beginPath();
      for (const p of pos.drivers[c]) {
        const X = tx(p[1]), Y = ty(p[2]);
        if (!prev || Math.hypot(p[1] - prev.x, p[2] - prev.y) > 3000) b.moveTo(X, Y); // 300m 넘는 점프(데이터 공백)는 잇지 않는다
        else b.quadraticCurveTo(prev.X, prev.Y, (prev.X + X) / 2, (prev.Y + Y) / 2);
        prev = { x: p[1], y: p[2], X, Y };
      }
      b.stroke();
    }
    draw(...lastArgs);
  }

  function at(c, ft) {
    const a = pos.drivers[c];
    let lo = 0, hi = T.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (T[m] <= ft) lo = m; else hi = m - 1; }
    const p = a[lo], q = a[Math.min(lo + 1, a.length - 1)];
    const k = q[0] === p[0] ? 0 : Math.min(1, Math.max(0, (ft - p[0]) / (q[0] - p[0])));
    return [p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k];
  }

  // tracked: 강조할 드라이버 코드(없으면 null)
  function draw(fileT, tracked = null) {
    lastArgs = [fileT, tracked];
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    if (bg) ctx.drawImage(bg, 0, 0, W, H);
    ctx.font = '600 10px Inter, sans-serif'; ctx.textBaseline = 'middle';
    for (const c of [...codes.filter((x) => x !== tracked), ...(tracked ? [tracked] : [])]) {
      const d = meta.get(c), [x, y] = at(c, fileT), isT = c === tracked;
      ctx.beginPath(); ctx.arc(tx(x), ty(y), isT ? dot + 2.5 : dot, 0, Math.PI * 2);
      ctx.fillStyle = teamColor(d.teamId, d.color); ctx.fill();
      if (isT) { ctx.lineWidth = 2.5; ctx.strokeStyle = css('--text') || '#fff'; ctx.stroke(); }
      if (isT || (labels && !tracked)) { ctx.fillStyle = css('--text') || '#fff'; ctx.fillText(c, tx(x) + 9, ty(y)); }
    }
  }

  window.addEventListener('resize', layout);
  const themeWatch = new MutationObserver(layout);
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const destroy = () => { window.removeEventListener('resize', layout); themeWatch.disconnect(); };
  return { canvas, layout, draw, destroy, codes };
}
