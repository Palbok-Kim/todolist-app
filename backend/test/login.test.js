import { test, mock, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { pool } from '../src/db/pool.js';
import { ERR } from '../src/errors.js';
import { COOKIE_NAMES } from '../src/lib/cookies.js';
import { reset, size, EMAIL_LIMIT } from '../src/lib/loginAttempts.js';
import { startApp, sessionFrom } from './helpers/api.js';
import { resetDb } from './helpers/db.js';

let api;
before(async () => {
  api = await startApp();
});
beforeEach(async () => {
  await resetDb(pool);
  reset();
});
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

const PASSWORD = 'correct horse battery staple 1!';
const INVALID_MESSAGE = '이메일 또는 비밀번호가 올바르지 않습니다.';
let n = 0;
const uniqueEmail = () => `u${++n}@example.test`;
const loginCall = (email, password = PASSWORD) =>
  call('/api/auth/login', { method: 'POST', body: { email, password } });
const logoutCall = (session) => call('/api/auth/logout', { method: 'POST', session });

// 가입 응답도 call로 받아 요청 로그가 테스트 출력에 섞이지 않게 한다
async function register(email = uniqueEmail()) {
  const res = await call('/api/auth/signup', {
    method: 'POST',
    body: { email, password: PASSWORD, name: '홍길동' },
  });
  assert.equal(res.status, 201);
  return { email, id: res.body.id };
}

const sha256 = (v) => createHash('sha256').update(v).digest('hex');
const cookieValue = (headers, name) =>
  headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .find((p) => p.startsWith(`${name}=`))
    ?.slice(name.length + 1);
const errorLogs = (logs) => logs.filter((l) => l.level === 'error');
const familyOf = async (raw) =>
  (await pool.query('SELECT family_id FROM refresh_tokens WHERE token_hash = $1', [sha256(raw)]))
    .rows[0].family_id;
const passwordHashOf = async (id) =>
  (await pool.query('SELECT password_hash FROM users WHERE id = $1', [id])).rows[0].password_hash;

async function downgradeHash(id) {
  const salt = randomBytes(16);
  const hash = scryptSync(PASSWORD, salt, 64, { N: 1024, r: 8, p: 1 });
  const stored = `scrypt$1024$8$1$${salt.toString('base64url')}$${hash.toString('base64url')}`;
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [stored, id]);
  return stored;
}

function assertCookiesCleared(headers) {
  const lines = headers.getSetCookie();
  for (const name of Object.values(COOKIE_NAMES)) {
    const line = lines.find((c) => c.startsWith(`${name}=`));
    assert.ok(line, name);
    assert.ok(/Expires=Thu, 01 Jan 1970|Max-Age=0/.test(line), line);
  }
}

test('AC-14: 올바른 이메일·비밀번호로 로그인하면 200 User와 세션 쿠키 3개를 주고 대문자 이메일도 통과한다', async () => {
  const { email, id } = await register();
  const res = await loginCall(email);
  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(res.body).sort(), [
    'createdAt',
    'email',
    'id',
    'name',
    'timezone',
    'updatedAt',
  ]);
  assert.equal(res.body.id, id);
  const names = res.headers.getSetCookie().map((c) => c.split('=')[0]);
  for (const name of Object.values(COOKIE_NAMES)) assert.ok(names.includes(name), name);

  const upper = await loginCall(email.toUpperCase());
  assert.equal(upper.status, 200);
  assert.equal(upper.body.id, id);
});

test('AC-14: 로그인마다 새 계열의 리프레시 토큰이 생기고 같은 사용자의 만료 행은 지워진다', async () => {
  const { email, id } = await register();
  const expiredHash = randomBytes(32).toString('hex');
  await pool.query(
    "INSERT INTO refresh_tokens (user_id, family_id, token_hash, created_at, expires_at) VALUES ($1, gen_random_uuid(), $2, now() - interval '8 days', now() - interval '1 day')",
    [id, expiredHash],
  );

  assert.equal((await loginCall(email)).status, 200);
  assert.equal((await loginCall(email)).status, 200);

  const { rows } = await pool.query('SELECT family_id FROM refresh_tokens WHERE user_id = $1', [
    id,
  ]);
  assert.equal(rows.length, 3); // 가입 1 + 로그인 2
  assert.equal(new Set(rows.map((r) => r.family_id)).size, 3);
  const left = await pool.query('SELECT 1 FROM refresh_tokens WHERE token_hash = $1', [
    expiredHash,
  ]);
  assert.equal(left.rowCount, 0);
});

test('AC-14: 틀린 비밀번호와 없는 이메일은 같은 401 INVALID_CREDENTIALS 본문을 준다', async () => {
  const { email } = await register();
  const wrong = await loginCall(email, 'wrong password value');
  const missing = await loginCall(uniqueEmail());
  assert.equal(wrong.status, 401);
  assert.equal(missing.status, 401);
  assert.deepEqual(wrong.body, {
    error: { code: ERR.INVALID_CREDENTIALS.code, message: INVALID_MESSAGE },
  });
  assert.deepEqual(missing.body, wrong.body);
});

test('AC-15: 같은 계정 5회 실패 뒤에는 올바른 비밀번호도 429이고 4회 실패 뒤에는 200이다', async () => {
  const edge = await register();
  for (let i = 0; i < EMAIL_LIMIT - 1; i++)
    assert.equal((await loginCall(edge.email, 'wrong password value')).status, 401);
  assert.equal((await loginCall(edge.email)).status, 200);

  reset();
  const { email } = await register();
  for (let i = 0; i < EMAIL_LIMIT; i++)
    assert.equal((await loginCall(email, 'wrong password value')).status, 401);
  const limited = await loginCall(email);
  assert.equal(limited.status, 429);
  assert.deepEqual(limited.body, {
    error: {
      code: ERR.TOO_MANY_REQUESTS.code,
      message: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    },
  });
});

test('NFR-10: 없는 이메일도 5회 실패하면 같은 이메일 시도가 429다', async () => {
  const email = uniqueEmail();
  for (let i = 0; i < EMAIL_LIMIT; i++) assert.equal((await loginCall(email)).status, 401);
  const res = await loginCall(email);
  assert.equal(res.status, 429);
  assert.equal(res.body.error.code, ERR.TOO_MANY_REQUESTS.code);
});

test('AQ-04: 129자 비밀번호는 400 VALIDATION_ERROR이고 실패 횟수에 넣지 않는다', async () => {
  const { email } = await register();
  for (let i = 0; i < EMAIL_LIMIT + 1; i++) {
    const res = await loginCall(email, 'a'.repeat(129));
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, ERR.VALIDATION_ERROR.code);
  }
  assert.equal(size().email, 0);
  assert.equal((await loginCall(email)).status, 200);
});

test('AC-14: 로그인은 VR-02(길이·문자 종류)를 검사하지 않아 틀린 14자 비밀번호는 401이다', async () => {
  const { email } = await register();
  const res = await loginCall(email, 'a'.repeat(14));
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, ERR.INVALID_CREDENTIALS.code);
});

test('AC-16: 쿠키 없이 로그아웃해도 200이고 세션 쿠키 3개를 지운다', async () => {
  const res = await logoutCall();
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
  assertCookiesCleared(res.headers);
});

test('AC-16, BR-01: 로그아웃은 그 세션의 계열만 폐기하고 다른 기기 계열은 남긴다', async () => {
  const { email, id } = await register();
  const a = await loginCall(email);
  const b = await loginCall(email);
  const familyA = await familyOf(cookieValue(a.headers, COOKIE_NAMES.refresh));
  const familyB = await familyOf(cookieValue(b.headers, COOKIE_NAMES.refresh));

  const res = await logoutCall(sessionFrom(a.headers));
  assert.equal(res.status, 200);
  assertCookiesCleared(res.headers);

  const { rows } = await pool.query(
    'SELECT family_id, revoked_at FROM refresh_tokens WHERE user_id = $1',
    [id],
  );
  const ofA = rows.filter((r) => r.family_id === familyA);
  const ofB = rows.filter((r) => r.family_id === familyB);
  assert.ok(ofA.length > 0 && ofB.length > 0);
  for (const r of ofA) assert.notEqual(r.revoked_at, null);
  for (const r of ofB) assert.equal(r.revoked_at, null);
});

test('AC-16, BR-01: 토큰 폐기가 실패해도 로그아웃은 200이고 쿠키를 지우며 오류 로그를 남긴다', async () => {
  const { email } = await register();
  const login = await loginCall(email);
  const raw = cookieValue(login.headers, COOKIE_NAMES.refresh);
  await pool.query(
    "CREATE OR REPLACE FUNCTION test_fail_revoke() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced revoke'; END $$",
  );
  await pool.query(
    'CREATE TRIGGER test_fail_revoke BEFORE UPDATE ON refresh_tokens FOR EACH ROW EXECUTE FUNCTION test_fail_revoke()',
  );
  try {
    const res = await logoutCall(sessionFrom(login.headers));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'ok' });
    assertCookiesCleared(res.headers);
    assert.ok(!res.text.includes('forced'));
    assert.ok(errorLogs(res.logs).some((l) => l.message === '로그아웃 토큰 폐기 실패'));
    const { rows } = await pool.query(
      'SELECT revoked_at FROM refresh_tokens WHERE token_hash = $1',
      [sha256(raw)],
    );
    assert.equal(rows[0].revoked_at, null);
  } finally {
    await pool.query('DROP TRIGGER IF EXISTS test_fail_revoke ON refresh_tokens');
    await pool.query('DROP FUNCTION IF EXISTS test_fail_revoke()');
  }
});

test('AC-16: 모르는 리프레시 토큰으로 로그아웃해도 200이다', async () => {
  const res = await logoutCall({ cookie: `${COOKIE_NAMES.refresh}=unknown` });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
});

test('NFR-06: 저장 해시 파라미터가 현재와 다르면 로그인 성공 때 현재 파라미터로 재해시한다', async () => {
  const { email, id } = await register();
  await downgradeHash(id);
  assert.equal((await loginCall(email)).status, 200);
  assert.ok((await passwordHashOf(id)).startsWith('scrypt$32768$8$3$'));
  assert.equal((await loginCall(email)).status, 200); // 갱신된 해시로도 로그인된다
});

test('NFR-06: 재해시 저장이 실패해도 로그인은 200이고 기존 해시를 유지하며 오류 로그를 남긴다', async () => {
  const { email, id } = await register();
  const stored = await downgradeHash(id);
  await pool.query(
    "CREATE OR REPLACE FUNCTION test_fail_rehash() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced rehash'; END $$",
  );
  await pool.query(
    'CREATE TRIGGER test_fail_rehash BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION test_fail_rehash()',
  );
  try {
    const res = await loginCall(email);
    assert.equal(res.status, 200);
    assert.ok(!res.text.includes('forced'));
    assert.ok(errorLogs(res.logs).some((l) => l.message === '비밀번호 재해시 실패'));
    assert.equal(await passwordHashOf(id), stored);
  } finally {
    await pool.query('DROP TRIGGER IF EXISTS test_fail_rehash ON users');
    await pool.query('DROP FUNCTION IF EXISTS test_fail_rehash()');
  }
});

test('SO-06: 로그인·로그아웃 응답과 로그에 비밀번호·리프레시 토큰이 남지 않는다', async () => {
  const { email } = await register();
  const login = await loginCall(email);
  assert.equal(login.status, 200);
  const raw = cookieValue(login.headers, COOKIE_NAMES.refresh);
  assert.ok(raw);
  const failed = await loginCall(email, `${PASSWORD} wrong`);
  const logout = await logoutCall(sessionFrom(login.headers));
  for (const res of [login, failed, logout]) {
    const allLogs = JSON.stringify(res.logs);
    for (const secret of [PASSWORD, raw]) {
      assert.ok(!res.text.includes(secret));
      assert.ok(!allLogs.includes(secret));
    }
  }
});

test('NFR-10: 같은 계정으로 틀린 비밀번호 20건을 동시에 보내도 검증은 한도(5건)만 하고 나머지는 429다', async () => {
  const { email } = await register();
  const results = await Promise.all(
    Array.from({ length: 20 }, () => loginCall(email, 'wrong password 123')),
  );
  const statuses = results.map((r) => r.status);
  assert.equal(statuses.filter((s) => s === 401).length, EMAIL_LIMIT);
  assert.equal(statuses.filter((s) => s === 429).length, 20 - EMAIL_LIMIT);
});

test('NFR-10: 동시에 성공한 로그인은 실패 횟수를 남기지 않는다', async () => {
  const { email } = await register();
  const results = await Promise.all(Array.from({ length: 4 }, () => loginCall(email)));
  assert.ok(results.every((r) => r.status === 200));
  assert.deepEqual(size(), { ip: 0, email: 0 });
});
