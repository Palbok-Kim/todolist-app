import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getToday, toIsoTimestamp } from '../../src/lib/today.js';

const NOW = new Date(Date.UTC(2026, 10, 3, 20)); // 2026-11-03T20:00:00Z

test('R-05: 같은 순간에 Asia/Seoul은 2026-11-04, UTC는 2026-11-03이다', () => {
  assert.equal(getToday('Asia/Seoul', NOW), '2026-11-04');
  assert.equal(getToday('UTC', NOW), '2026-11-03');
});

test('TQ-03: Pacific/Kiritimati와 Pacific/Pago_Pago는 같은 순간에 날짜가 다르다', () => {
  const kiri = getToday('Pacific/Kiritimati', NOW);
  const pago = getToday('Pacific/Pago_Pago', NOW);
  assert.equal(kiri, '2026-11-04');
  assert.equal(pago, '2026-11-03');
  assert.notEqual(kiri, pago);
});

test('R-05: now를 생략하면 현재 시각 기준 YYYY-MM-DD를 돌려준다', () => {
  assert.match(getToday('Asia/Seoul'), /^\d{4}-\d{2}-\d{2}$/);
});

test('R-05: toIsoTimestamp는 밀리초를 ISO 8601 UTC 문자열로 바꾼다', () => {
  assert.equal(toIsoTimestamp(0), '1970-01-01T00:00:00.000Z');
});
