import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkEmail,
  checkPassword,
  checkName,
  normalizeTimezone,
  validateSignup,
  validateLogin,
} from '../../src/validation/user.validation.js';

const fieldNames = (r) => r.fields.map((f) => f.field).sort();
const okSignup = {
  email: 'a@example.com',
  password: 'p'.repeat(15),
  name: '홍길동',
  timezone: 'UTC',
};

test('VR-02: 비밀번호 14자는 거부, 15자·128자는 통과, 129자는 거부된다', () => {
  assert.ok(checkPassword('p'.repeat(14)).error);
  assert.deepEqual(checkPassword('p'.repeat(15)), { value: 'p'.repeat(15) });
  assert.deepEqual(checkPassword('p'.repeat(128)), { value: 'p'.repeat(128) });
  assert.ok(checkPassword('p'.repeat(129)).error);
});

test('VR-02: 앞뒤 공백이 있는 비밀번호는 그대로 반환된다', () => {
  const pw = '  spaced password  ';
  assert.equal(checkPassword(pw).value, pw);
});

test('VR-02: 문자열이 아닌 비밀번호는 거부된다', () => {
  for (const v of [undefined, null, 123, {}]) assert.ok(checkPassword(v).error);
});

test('VR-01: email은 소문자로 정규화되고 앞뒤 공백이 제거된다', () => {
  assert.deepEqual(checkEmail('A@Example.com'), { value: 'a@example.com' });
  assert.deepEqual(checkEmail('  a@example.com  '), { value: 'a@example.com' });
});

test('VR-01: email 254자는 통과, 255자는 거부된다', () => {
  const local = (n) => 'a'.repeat(n) + '@example.com';
  assert.equal(local(242).length, 254);
  assert.equal(checkEmail(local(242)).value, local(242));
  assert.ok(checkEmail(local(243)).error);
});

test('VR-01: 형식 오류·누락·빈값 email은 거부된다', () => {
  for (const v of ['no-at', 'a@b', 'a b@c.com', '@example.com', '', '   ', undefined, null, 1]) {
    assert.ok(checkEmail(v).error, String(v));
  }
});

test('VR-03: name 0자·공백만·51자는 거부, 1자·50자는 통과한다', () => {
  assert.ok(checkName('').error);
  assert.ok(checkName('   ').error);
  assert.ok(checkName(undefined).error);
  assert.ok(checkName('가'.repeat(51)).error);
  assert.deepEqual(checkName('가'), { value: '가' });
  assert.deepEqual(checkName('가'.repeat(50)), { value: '가'.repeat(50) });
  assert.deepEqual(checkName('  홍길동  '), { value: '홍길동' });
});

test('VR-04: timezone 오프셋·없는 이름·비문자열은 null이다', () => {
  for (const v of ['+09:00', 'Not/AZone', 9, undefined, null, '']) {
    assert.equal(normalizeTimezone(v), null, String(v));
  }
});

test('VR-04: UTC·Asia/Seoul은 통과하고 정규형으로 반환된다', () => {
  assert.equal(normalizeTimezone('UTC'), 'UTC');
  assert.equal(normalizeTimezone('Asia/Seoul'), 'Asia/Seoul');
  assert.equal(normalizeTimezone('asia/seoul'), 'Asia/Seoul');
});

test('VR-01: 가입 입력이 올바르면 fields가 비고 정규화된 value를 돌려준다', () => {
  const r = validateSignup({ ...okSignup, email: ' A@Example.com ', name: ' 홍길동 ' });
  assert.deepEqual(r.fields, []);
  assert.deepEqual(r.value, {
    email: 'a@example.com',
    password: okSignup.password,
    name: '홍길동',
    timezone: 'UTC',
  });
});

test('VR-04: 가입 시 timezone이 없거나 잘못되면 Asia/Seoul이고 오류가 아니다', () => {
  for (const timezone of [undefined, '+09:00', 'Not/AZone']) {
    const r = validateSignup({ ...okSignup, timezone });
    assert.deepEqual(r.fields, []);
    assert.equal(r.value.timezone, 'Asia/Seoul');
  }
});

test('VR-01: 가입 입력 여러 필드 오류는 API 필드 이름으로 모두 돌려준다', () => {
  const r = validateSignup({ email: 'bad', password: 'short', name: '   ' });
  assert.deepEqual(fieldNames(r), ['email', 'name', 'password']);
  for (const f of r.fields) assert.equal(typeof f.message, 'string');
});

test('VR-01: body가 null·배열·문자열이어도 throw하지 않고 오류를 돌려준다', () => {
  for (const body of [null, undefined, [], 'text']) {
    const r = validateSignup(body);
    assert.deepEqual(fieldNames(r), ['email', 'name', 'password']);
    assert.equal(r.value.timezone, 'Asia/Seoul');
  }
});

test('AQ-04: 로그인 비밀번호는 10자도 통과하고 공백을 유지하며 email은 정규화된다', () => {
  const r = validateLogin({ email: ' A@Example.com ', password: ' p'.repeat(5) });
  assert.deepEqual(r.fields, []);
  assert.deepEqual(r.value, { email: 'a@example.com', password: ' p'.repeat(5) });
});

test('AQ-04: 로그인 비밀번호 128자는 통과, 129자·빈 문자열·비문자열은 거부된다', () => {
  assert.deepEqual(validateLogin({ email: 'a@example.com', password: 'p'.repeat(128) }).fields, []);
  for (const password of ['p'.repeat(129), '', undefined, 123]) {
    const r = validateLogin({ email: 'a@example.com', password });
    assert.deepEqual(fieldNames(r), ['password']);
    assert.equal(r.fields[0].message, '비밀번호를 확인해 주세요.');
  }
});

test('AQ-04: 로그인 email 오류와 body null도 fields로 돌려준다', () => {
  assert.deepEqual(fieldNames(validateLogin({ email: 'bad', password: 'x' })), ['email']);
  assert.deepEqual(fieldNames(validateLogin(null)), ['email', 'password']);
  assert.deepEqual(fieldNames(validateLogin([])), ['email', 'password']);
});
