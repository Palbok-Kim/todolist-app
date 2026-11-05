import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  WINDOW_MS,
  IP_LIMIT,
  EMAIL_LIMIT,
  MAX_KEYS,
  isLimited,
  recordFailure,
  reserve,
  release,
  sweep,
  reset,
  size,
} from '../../src/lib/loginAttempts.js';

const t0 = 1_800_000_000_000;

beforeEach(() => reset());

test('NFR-10: 한도 상수는 15분·IP 10회·계정 5회·키 10,000개다', () => {
  assert.deepEqual([WINDOW_MS, IP_LIMIT, EMAIL_LIMIT, MAX_KEYS], [900_000, 10, 5, 10_000]);
});

test('NFR-10: 같은 계정 4회 실패는 제한하지 않고 5회면 제한한다', () => {
  const key = { email: 'a@example.com' };
  for (let i = 0; i < 4; i++) recordFailure(key, t0);
  assert.equal(isLimited(key, t0), false);
  recordFailure(key, t0);
  assert.equal(isLimited(key, t0), true);
  assert.equal(isLimited(key, t0 + WINDOW_MS - 1), true);
});

test('NFR-10: 시간 창이 지난 now면 계정 제한이 해제된다', () => {
  const key = { email: 'a@example.com' };
  for (let i = 0; i < 5; i++) recordFailure(key, t0);
  assert.equal(isLimited(key, t0 + WINDOW_MS), false);
  assert.equal(size().email, 0);
});

test('NFR-10: 같은 IP에서 서로 다른 계정 10회 실패 뒤 그 IP가 제한된다', () => {
  for (let i = 0; i < 10; i++) recordFailure({ ip: '1.1.1.1', email: `u${i}@example.com` }, t0);
  assert.equal(isLimited({ ip: '1.1.1.1', email: 'new@example.com' }, t0), true);
  assert.equal(isLimited({ ip: '2.2.2.2', email: 'new@example.com' }, t0), false);
});

test('NFR-10: 제한 중 실패는 IP 횟수를 늘리지 않는다', () => {
  for (let i = 0; i < 10; i++) recordFailure({ ip: '1.1.1.1', email: `u${i}@example.com` }, t0);
  assert.equal(recordFailure({ ip: '1.1.1.1', email: 'x@example.com' }, t0).ip, 10);
  assert.equal(recordFailure({ ip: '1.1.1.1' }, t0).ip, 10);
});

test('NFR-10: 계정 한도 도달 뒤에도 계정 횟수는 5로 유지된다', () => {
  const key = { ip: '1.1.1.1', email: 'a@example.com' };
  const counts = [];
  for (let i = 0; i < 7; i++) counts.push(recordFailure(key, t0));
  assert.deepEqual(
    counts.map((c) => c.email),
    [1, 2, 3, 4, 5, 5, 5],
  );
  assert.deepEqual(
    counts.map((c) => c.ip),
    [1, 2, 3, 4, 5, 6, 7],
  );
});

test('NFR-10: 시간 창이 지난 뒤 실패 기록은 1부터 다시 센다', () => {
  const key = { ip: '1.1.1.1', email: 'a@example.com' };
  for (let i = 0; i < 5; i++) recordFailure(key, t0);
  assert.deepEqual(recordFailure(key, t0 + WINDOW_MS), { ip: 1, email: 1 });
  assert.equal(isLimited(key, t0 + WINDOW_MS), false);
});

test('NFR-10: windowMs 인자로 시간 창을 바꿀 수 있다', () => {
  const key = { email: 'a@example.com' };
  for (let i = 0; i < 5; i++) recordFailure(key, t0, 1000);
  assert.equal(isLimited(key, t0 + 999, 1000), true);
  assert.equal(isLimited(key, t0 + 1000, 1000), false);
});

test('NFR-10: ip나 email 한쪽만 줘도 동작하고 없는 쪽은 무시한다', () => {
  assert.equal(recordFailure({ ip: '1.1.1.1' }, t0).ip, 1);
  assert.equal(recordFailure({ email: 'a@example.com' }, t0).email, 1);
  assert.deepEqual(size(), { ip: 1, email: 1 });
  assert.equal(isLimited({ ip: '1.1.1.1' }, t0), false);
  assert.equal(isLimited({ email: 'a@example.com' }, t0), false);
  assert.equal(isLimited({}, t0), false);
});

test('AQ-10: 키 상한을 넘기면 가장 오래된 IP가 지워지고 키 수는 상한을 넘지 않는다', () => {
  for (let i = 0; i <= MAX_KEYS; i++) recordFailure({ ip: `ip-${i}` }, t0);
  assert.equal(size().ip, MAX_KEYS);
  assert.equal(size().email, 0);
  // 마지막 키는 남아 있어 횟수가 이어진다
  assert.equal(recordFailure({ ip: `ip-${MAX_KEYS}` }, t0).ip, 2);
  // 첫 키는 지워져 다시 1부터 센다
  assert.equal(recordFailure({ ip: 'ip-0' }, t0).ip, 1);
  assert.equal(size().ip, MAX_KEYS);
});

test('AQ-10: 키 상한은 계정 Map에도 적용된다', () => {
  for (let i = 0; i <= MAX_KEYS; i++) recordFailure({ email: `u${i}@example.com` }, t0);
  assert.equal(size().email, MAX_KEYS);
  assert.equal(recordFailure({ email: 'u0@example.com' }, t0).email, 1);
});

test('NFR-10: sweep은 만료 항목만 지운다', () => {
  recordFailure({ ip: '1.1.1.1', email: 'a@example.com' }, t0);
  recordFailure({ ip: '2.2.2.2', email: 'b@example.com' }, t0 + 10);
  sweep(t0 + WINDOW_MS - 1);
  assert.deepEqual(size(), { ip: 2, email: 2 });
  sweep(t0 + WINDOW_MS);
  assert.deepEqual(size(), { ip: 1, email: 1 });
  sweep(t0 + 10 + WINDOW_MS);
  assert.deepEqual(size(), { ip: 0, email: 0 });
});

test('NFR-10: reserve는 확인과 집계를 한 번에 해 한도만큼만 통과시키고 release는 되돌린다', () => {
  reset();
  const key = { ip: '10.9.9.9', email: 'race@example.test' };
  const passed = Array.from({ length: 20 }, () => reserve(key)).filter(Boolean).length;
  assert.equal(passed, EMAIL_LIMIT);
  assert.equal(isLimited(key), true);
  reset();
  assert.equal(reserve(key), true);
  release(key);
  assert.deepEqual(size(), { ip: 0, email: 0 }); // 성공은 집계하지 않는다
  release(key); // 없는 항목 release는 무시
  assert.deepEqual(size(), { ip: 0, email: 0 });
});
