import { test, mock, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pool } from '../src/db/pool.js';
import { ERR } from '../src/errors.js';
import { COOKIE_NAMES } from '../src/lib/cookies.js';
import { startApp, sessionFrom } from './helpers/api.js';
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

async function call(path, init) {
  const logs = [];
  const spy = mock.method(console, 'log', (line) => logs.push(JSON.parse(line)));
  try {
    const res = await api.request(path, init);
    await new Promise((r) => setImmediate(r)); // finish 이벤트의 요청 로그를 기다린다
    return { ...res, logs };
  } finally {
    spy.mock.restore();
  }
}

const PASSWORD = 'correct horse battery staple';
let n = 0;
const uniqueEmail = () => `u${++n}@example.test`;
const signupCall = (body) => call('/api/auth/signup', { method: 'POST', body });
const input = (extra = {}) => ({
  email: uniqueEmail(),
  password: PASSWORD,
  name: '홍길동',
  ...extra,
});
const count = async (sql, params) => Number((await pool.query(sql, params)).rows[0].count);
const cookieValue = (headers, name) =>
  headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .find((p) => p.startsWith(`${name}=`))
    ?.slice(name.length + 1);
const infoLog = (logs) => logs.find((l) => l.level === 'info');

test('AC-01: 가입하면 201 User를 주고 이메일은 소문자이며 기본 카테고리가 하나 생긴다', async () => {
  const { status, body } = await signupCall(input({ email: 'New.User@Example.TEST' }));
  assert.equal(status, 201);
  assert.deepEqual(Object.keys(body).sort(), [
    'createdAt',
    'email',
    'id',
    'name',
    'timezone',
    'updatedAt',
  ]);
  assert.equal(body.email, 'new.user@example.test');
  assert.equal(
    await count('SELECT count(*) FROM categories WHERE user_id = $1 AND is_default', [body.id]),
    1,
  );
  assert.equal(await count('SELECT count(*) FROM categories WHERE user_id = $1', [body.id]), 1);
});

test('VR-01: 대소문자만 다른 이메일로 재가입하면 409 CONFLICT이고 사용자는 하나뿐이다', async () => {
  const first = await signupCall(input({ email: 'Case@Example.test' }));
  assert.equal(first.status, 201);
  const { status, body } = await signupCall(input({ email: 'case@EXAMPLE.TEST' }));
  assert.equal(status, 409);
  assert.deepEqual(body, {
    error: {
      code: ERR.CONFLICT.code,
      message: '이미 사용 중인 이메일입니다.',
      fields: [{ field: 'email', message: '이미 사용 중인 이메일입니다.' }],
    },
  });
  assert.equal(await count('SELECT count(*) FROM users'), 1);
});

test('NFR-07: 가입 응답의 세션 쿠키 3개로 인증을 통과하고 로그 userId는 가입한 사용자다', async () => {
  const res = await signupCall(input());
  assert.equal(res.status, 201);
  const names = res.headers.getSetCookie().map((c) => c.split('=')[0]);
  for (const name of Object.values(COOKIE_NAMES)) assert.ok(names.includes(name), name);

  const authed = await call('/api/users/me', { session: sessionFrom(res.headers) });
  assert.equal(authed.status, 200);
  assert.equal(authed.body.id, res.body.id);
  assert.equal(infoLog(authed.logs).userId, res.body.id);

  assert.equal((await call('/api/users/me')).status, 401); // 세션 없으면 같은 경로가 401
});

test('SO-17: 리프레시 토큰은 원문이 아니라 SHA-256 hex로만 저장된다', async () => {
  const res = await signupCall(input());
  assert.equal(res.status, 201);
  const raw = cookieValue(res.headers, COOKIE_NAMES.refresh);
  assert.ok(raw);
  const { rows } = await pool.query(
    'SELECT token_hash, family_id, expires_at > now() AS alive FROM refresh_tokens WHERE user_id = $1',
    [res.body.id],
  );
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].token_hash, raw);
  assert.equal(rows[0].token_hash, createHash('sha256').update(raw).digest('hex'));
  assert.ok(rows[0].family_id);
  assert.equal(rows[0].alive, true);
});

test('VR-04: timezone이 없거나 IANA 이름이 아니면 Asia/Seoul, UTC는 그대로 저장한다', async () => {
  for (const [timezone, expected] of [
    [undefined, 'Asia/Seoul'],
    ['+09:00', 'Asia/Seoul'],
    ['UTC', 'UTC'],
  ]) {
    const { status, body } = await signupCall(input(timezone === undefined ? {} : { timezone }));
    assert.equal(status, 201, String(timezone));
    assert.equal(body.timezone, expected);
    const { rows } = await pool.query('SELECT timezone FROM users WHERE id = $1', [body.id]);
    assert.equal(rows[0].timezone, expected);
  }
});

test('BR-03: 기본 카테고리 생성이 실패하면 사용자·리프레시 토큰까지 모두 롤백되고 500이다', async () => {
  await pool.query(
    "CREATE OR REPLACE FUNCTION test_fail_default() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced failure'; END $$",
  );
  await pool.query(
    'CREATE TRIGGER test_fail_default BEFORE INSERT ON categories FOR EACH ROW WHEN (NEW.is_default) EXECUTE FUNCTION test_fail_default()',
  );
  try {
    const { status, body, text } = await signupCall(input()); // call이 console.log를 막아 오류 로그가 출력되지 않는다
    assert.equal(status, 500);
    assert.equal(body.error.code, ERR.INTERNAL_ERROR.code);
    assert.ok(!text.includes('forced'));
    for (const table of ['users', 'refresh_tokens', 'categories'])
      assert.equal(await count(`SELECT count(*) FROM ${table}`), 0, table);
  } finally {
    await pool.query('DROP TRIGGER IF EXISTS test_fail_default ON categories');
    await pool.query('DROP FUNCTION IF EXISTS test_fail_default()');
  }
});

test('SO-06: 비밀번호·리프레시 토큰·해시는 응답과 로그에 남지 않는다', async () => {
  const { status, headers, text, logs } = await signupCall(input());
  assert.equal(status, 201);
  const raw = cookieValue(headers, COOKIE_NAMES.refresh);
  const allLogs = JSON.stringify(logs);
  for (const secret of [PASSWORD, raw]) {
    assert.ok(!text.includes(secret));
    assert.ok(!allLogs.includes(secret));
  }
  for (const key of ['passwordHash', 'password_hash']) assert.ok(!text.includes(key), key);
});

test('ERR-01: 필수값 누락이나 14자 비밀번호는 400 VALIDATION_ERROR이고 사용자가 생기지 않는다', async () => {
  const empty = await signupCall({});
  assert.equal(empty.status, 400);
  assert.equal(empty.body.error.code, ERR.VALIDATION_ERROR.code);
  assert.equal(empty.body.error.message, '입력값을 확인해 주세요.');
  const fields = new Set(empty.body.error.fields.map((f) => f.field));
  for (const f of ['email', 'password', 'name']) assert.ok(fields.has(f), f);
  assert.ok(!fields.has('timezone'));

  const short = await signupCall(input({ password: 'a'.repeat(14) }));
  assert.equal(short.status, 400);
  assert.equal(short.body.error.code, ERR.VALIDATION_ERROR.code);
  assert.equal(short.body.error.fields.length, 1);
  assert.equal(short.body.error.fields[0].field, 'password');

  assert.equal(await count('SELECT count(*) FROM users'), 0);
});
