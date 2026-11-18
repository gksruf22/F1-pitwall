// 하이라이트 다듬기 검증 규칙: 숫자·이름을 바꾸면 거절한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keepsFacts } from './ai-highlights.js';

test('숫자·이름 보존 검사', () => {
  const o = 'Andrea Kimi Antonelli, Italian Grand Prix에서 19번 그리드 → 1위 (18계단 상승)';
  assert.ok(keepsFacts(o, 'Andrea Kimi Antonelli가 Italian Grand Prix에서 19번 그리드에서 출발해 1위까지 18계단을 올랐다'));
  assert.ok(!keepsFacts(o, 'Andrea Kimi Antonelli가 Italian Grand Prix에서 19번 그리드에서 출발해 1위까지 17계단을 올랐다')); // 숫자 변경
  assert.ok(!keepsFacts(o, 'Andrea Kimi Antonelli가 Italian Grand Prix에서 1위까지 18계단을 올랐다')); // 숫자 누락
  assert.ok(!keepsFacts(o, '안토넬리가 이탈리아 그랑프리에서 19번 그리드에서 1위까지 18계단을 올랐다')); // 이름 번역
  assert.ok(!keepsFacts(o, ''));
});
