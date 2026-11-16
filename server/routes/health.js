import { Router } from 'express';

const router = Router();

// 서버 기동 확인용(Render 배포 후 콜드 스타트 점검에도 사용)
router.get('/', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

export default router;
