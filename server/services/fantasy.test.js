// 채점 규칙 확인: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { scorePrediction } from './fantasy.js';

test('채점 규칙', () => {
  const podium = ['a', 'b', 'c'];
  assert.deepEqual(scorePrediction(['a', 'b', 'c'], podium), { score: 12, exact: 3 }); // 9 + 보너스 3
  assert.deepEqual(scorePrediction(['a', 'b', 'x'], podium), { score: 6, exact: 2 });
  assert.deepEqual(scorePrediction(['a', 'c', 'b'], podium), { score: 5, exact: 1 }); // 3 + 1 + 1
  assert.deepEqual(scorePrediction(['b', 'a', 'x'], podium), { score: 2, exact: 0 });
  assert.deepEqual(scorePrediction(['x', 'y', 'z'], podium), { score: 0, exact: 0 });
});
