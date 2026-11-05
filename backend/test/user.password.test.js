import { test, mock, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pool } from '../src/db/pool.js';
import { ERR } from '../src/errors.js';
import { COOKIE_NAMES } from '../src/lib/cookies.js';
import { EMAIL_LIMIT, reset, size } from '../src/lib/loginAttempts.js';
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

// 요청 로그를 모아 두고 테스트 출력에는 섞지 않는다
async function call(path, init) {
  const logs = [];
  const spy = mock.method(console, 'log', (line) => logs.push(line));
  try {
    const res = await api.request(path, init);
    await new Promise((r) => setImmediate(r)); // finish 이벤트의 요청 로그를 기다린다
    return { ...res, logs };
  } finally {
    spy.mock.restore();
  }
}

const EMAIL = 'me@example.test';
const OLD = 'correct horse battery staple';
const NEW = ' new  passphrase with spaces ';
const sha256 = (v) => createHash('sha256').update(v).digest('hex');
const refreshOf = (headers) =>
  headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .find((p) => p.startsWith(`${COOKIE_NAMES.refresh}=`))
    ?.slice(COOKIE_NAMES.refresh.length + 1);

async function signupSession() {
  const res = await call('/api/auth/signup', {
    method: 'POST',
    body: { email: EMAIL, password: OLD, name: '홍길동' },
  });
  assert.equal(res.status, 201);
  return { ...sessionFrom(res.headers), refresh: refreshOf(res.headers) };
}
async function loginSession(password = OLD) {
  const res = await call('/api/auth/login', { method: 'POST', body: { email: EMAIL, password } });
  return { res, session: { ...sessionFrom(res.headers), refresh: refreshOf(res.headers) } };
}
const change = (session, body) => call('/api/users/me/password', { method: 'PUT', session, body });
const tokenRows = async () =>
  (
    await pool.query(
      'SELECT token_hash, family_id, revoked_at FROM refresh_tokens ORDER BY created_at',
    )
  ).rows;

test('AC-20: 변경 응답의 새 쿠키로 보호 라우트가 되고, 이후 로그인은 새 비밀번호만 통한다', async () => {
  const current = await signupSession();
  const res = await change(current, { currentPassword: OLD, newPassword: NEW });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
  const names = res.headers.getSetCookie().map((c) => c.split('=')[0]);
  for (const name of Object.values(COOKIE_NAMES)) assert.ok(names.includes(name), name);

  const fresh = sessionFrom(res.headers);
  assert.equal((await call('/api/users/me', { session: fresh })).status, 200);
  assert.equal((await loginSession(OLD)).res.status, 401);
  assert.equal((await loginSession(NEW)).res.status, 200);
});

test('AC-20: 변경하면 이전 리프레시 행이 모두 폐기되고 현재 세션의 새 계열 행만 유효하다', async () => {
  const current = await signupSession();
  const other = (await loginSession()).session; // 다른 기기
  const res = await change(current, { currentPassword: OLD, newPassword: NEW });
  const newRefresh = refreshOf(res.headers);

  const rows = await tokenRows();
  const valid = rows.filter((r) => r.revoked_at === null);
  assert.equal(valid.length, 1);
  assert.equal(valid[0].token_hash, sha256(newRefresh));
  for (const old of [current.refresh, other.refresh]) {
    const row = rows.find((r) => r.token_hash === sha256(old));
    assert.notEqual(row.revoked_at, null);
    assert.notEqual(row.family_id, valid[0].family_id);
  }
});

test('AC-20: 변경 전에 받아 둔 다른 기기의 리프레시 값으로 갱신하면 401 UNAUTHORIZED다', async () => {
  await signupSession();
  const other = (await loginSession()).session;
  const current = (await loginSession()).session;
  await change(current, { currentPassword: OLD, newPassword: NEW });
  const res = await call('/api/auth/refresh', {
    method: 'POST',
    session: { cookie: `${COOKIE_NAMES.refresh}=${other.refresh}` },
  });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, ERR.UNAUTHORIZED.code);
});

test('AC-21: 틀린 현재 비밀번호로 6회 시도해도 모두 400이고 로그인 제한·토큰 폐기가 없다', async () => {
  const current = await signupSession();
  const tries = EMAIL_LIMIT + 1;
  for (let i = 0; i < tries; i++) {
    const res = await change(current, { currentPassword: 'wrong password 123', newPassword: NEW });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, ERR.VALIDATION_ERROR.code);
    assert.deepEqual(
      res.body.error.fields.map((f) => f.field),
      ['currentPassword'],
    );
    assert.deepEqual(res.headers.getSetCookie(), []);
  }
  assert.deepEqual(size(), { ip: 0, email: 0 });
  assert.ok((await tokenRows()).every((r) => r.revoked_at === null));
  assert.equal((await loginSession(OLD)).res.status, 200);
});

test('VR-02: 새 비밀번호 14자·129자, 현재 비밀번호 누락은 400이고 비밀번호가 바뀌지 않는다', async () => {
  const current = await signupSession();
  const cases = [
    [{ currentPassword: OLD, newPassword: 'x'.repeat(14) }, ['newPassword']],
    [{ currentPassword: OLD, newPassword: 'x'.repeat(129) }, ['newPassword']],
    [{ newPassword: NEW }, ['currentPassword']],
    [{}, ['currentPassword', 'newPassword']],
  ];
  for (const [body, expected] of cases) {
    const res = await change(current, body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.deepEqual(
      res.body.error.fields.map((f) => f.field),
      expected,
    );
  }
  assert.equal((await loginSession(OLD)).res.status, 200);
});

test('NFR-15: CSRF 헤더 없는 변경은 403, 인증 없으면 401이고 비밀번호가 그대로다', async () => {
  const current = await signupSession();
  const body = { currentPassword: OLD, newPassword: NEW };
  assert.equal((await change({ ...current, csrfToken: undefined }, body)).status, 403);
  assert.equal((await change(undefined, body)).status, 401);
  assert.equal((await loginSession(OLD)).res.status, 200);
});

test('SO-06: 비밀번호와 리프레시 토큰 원문은 응답과 로그에 남지 않는다', async () => {
  const current = await signupSession();
  const res = await change(current, { currentPassword: OLD, newPassword: NEW });
  const dump = res.text + res.logs.join('\n');
  for (const secret of [OLD, NEW.trim(), refreshOf(res.headers)]) assert.ok(!dump.includes(secret));
});

test('DL-06: 토큰은 유효해도 계정이 지워졌으면 비밀번호 변경이 401이다', async () => {
  const current = await signupSession();
  await resetDb(pool);
  const res = await change(current, { currentPassword: OLD, newPassword: NEW });
  assert.equal(res.status, 401);
});
