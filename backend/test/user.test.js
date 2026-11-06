import { test, mock, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db/pool.js';
import { ERR } from '../src/errors.js';
import { startApp, signup } from './helpers/api.js';
import { resetDb } from './helpers/db.js';

let api;
before(async () => {
  api = await startApp();
});
beforeEach(() => resetDb(pool));
after(async () => {
  await api.close();
  await pool.end();
});

// 요청 로그가 테스트 출력에 섞이지 않게 console.log를 잠시 막는다
async function call(path, init) {
  const spy = mock.method(console, 'log', () => {});
  try {
    const res = await api.request(path, init);
    await new Promise((r) => setImmediate(r)); // finish 이벤트의 요청 로그를 기다린다
    return res;
  } finally {
    spy.mock.restore();
  }
}

const register = () => {
  const spy = mock.method(console, 'log', () => {});
  return signup(api, {
    email: 'me@example.test',
    password: 'correct horse battery staple 1!',
    name: '홍길동',
    timezone: 'Asia/Seoul',
  }).finally(() => spy.mock.restore());
};
const me = (session) => call('/api/users/me', { session });
const patchMe = (session, body) => call('/api/users/me', { method: 'PATCH', session, body });
const storedTimezone = async () =>
  (await pool.query('SELECT timezone FROM users')).rows[0].timezone;

test('AQ-03: 내 정보 조회는 User 필드만 주고 passwordHash가 없다', async () => {
  const session = await register();
  const res = await me(session);
  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(res.body).sort(), [
    'createdAt',
    'email',
    'id',
    'name',
    'timezone',
    'updatedAt',
  ]);
  assert.equal(res.body.id, session.body.id);
  assert.equal(res.body.email, 'me@example.test');
  assert.equal(res.body.timezone, 'Asia/Seoul');
  assert.ok(!res.text.includes('scrypt'));
});

test('VR-04: Asia/Seoul 사용자가 UTC로 바꾸면 200이고 조회 응답도 UTC다', async () => {
  const session = await register();
  const res = await patchMe(session, { timezone: 'UTC' });
  assert.equal(res.status, 200);
  assert.equal(res.body.timezone, 'UTC');
  assert.equal(res.body.passwordHash, undefined);
  assert.ok(res.body.updatedAt > session.body.updatedAt);
  assert.equal((await me(session)).body.timezone, 'UTC');
});

test('VR-04: 대소문자가 다른 IANA 이름은 정규형으로 저장한다(PQ-06)', async () => {
  const session = await register();
  const res = await patchMe(session, { timezone: 'america/new_york' });
  assert.equal(res.status, 200);
  assert.equal(await storedTimezone(), 'America/New_York');
});

test('VR-04: +09:00, 빈 문자열, Mars/Olympus, null은 400이고 저장 값이 그대로다', async () => {
  const session = await register();
  for (const body of [
    { timezone: '+09:00' },
    { timezone: '' },
    { timezone: 'Mars/Olympus' },
    { timezone: null },
  ]) {
    const res = await patchMe(session, body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal(res.body.error.code, ERR.VALIDATION_ERROR.code);
    assert.deepEqual(
      res.body.error.fields.map((f) => f.field),
      ['timezone'],
    );
  }
  assert.equal(await storedTimezone(), 'Asia/Seoul');
});

const storedUser = async () =>
  (await pool.query('SELECT email, name, timezone FROM users')).rows[0];

test('AC-19: name을 바꾸면 새 name으로 저장되고 email은 그대로다', async () => {
  const session = await register();
  const res = await patchMe(session, { name: '  김민지 ', email: 'other@example.test' });
  assert.equal(res.status, 200);
  assert.equal(res.body.name, '김민지');
  assert.equal(res.body.email, 'me@example.test');
  assert.deepEqual(await storedUser(), {
    email: 'me@example.test',
    name: '김민지',
    timezone: 'Asia/Seoul',
  });
});

test('AC-19: name과 timezone을 함께 바꿀 수 있고, 한쪽이 틀리면 둘 다 바뀌지 않는다', async () => {
  const session = await register();
  const bad = await patchMe(session, { name: '새 이름', timezone: '+09:00' });
  assert.equal(bad.status, 400);
  assert.deepEqual(
    bad.body.error.fields.map((f) => f.field),
    ['timezone'],
  );
  assert.equal((await storedUser()).name, '홍길동');

  const ok = await patchMe(session, { name: '새 이름', timezone: 'UTC' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.name, '새 이름');
  assert.equal(ok.body.timezone, 'UTC');
});

test('VR-03: 공백만·51자 name은 400이고, 바꿀 필드가 없는 본문도 400이다', async () => {
  const session = await register();
  for (const name of ['   ', 'x'.repeat(51), 12]) {
    const res = await patchMe(session, { name });
    assert.equal(res.status, 400, String(name));
    assert.deepEqual(
      res.body.error.fields.map((f) => f.field),
      ['name'],
    );
  }
  for (const body of [{}, { email: 'other@example.test' }]) {
    const res = await patchMe(session, body);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, ERR.VALIDATION_ERROR.code);
  }
  assert.equal((await storedUser()).name, '홍길동');
});

test('AC-02: 인증 없이 조회·수정하면 401이다', async () => {
  assert.equal((await me()).status, 401);
  const res = await patchMe(undefined, { timezone: 'UTC' });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, ERR.UNAUTHORIZED.code);
});

test('DL-06: 토큰은 유효해도 계정이 지워졌으면 조회·수정이 401이다', async () => {
  const session = await register();
  await resetDb(pool);
  assert.equal((await me(session)).status, 401);
  assert.equal((await patchMe(session, { timezone: 'UTC' })).status, 401);
});
