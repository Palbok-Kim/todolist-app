import { test, mock, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../src/config.js';
import { pool } from '../src/db/pool.js';
import { ERR } from '../src/errors.js';
import { COOKIE_NAMES } from '../src/lib/cookies.js';
import { reset, size } from '../src/lib/loginAttempts.js';
import { startApp } from './helpers/api.js';
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
const sha256 = (v) => createHash('sha256').update(v).digest('hex');
const cookiesOf = (headers) =>
  Object.fromEntries(
    headers.getSetCookie().map((c) => {
      const pair = c.split(';')[0];
      const i = pair.indexOf('=');
      return [pair.slice(0, i), pair.slice(i + 1)];
    }),
  );

async function signupUser(email = 'a@example.test') {
  const res = await call('/api/auth/signup', {
    method: 'POST',
    body: { email, password: PASSWORD, name: '홍길동' },
  });
  assert.equal(res.status, 201);
  return { userId: res.body.id, refresh: cookiesOf(res.headers)[COOKIE_NAMES.refresh] };
}
async function loginRefresh(email = 'a@example.test') {
  const res = await call('/api/auth/login', {
    method: 'POST',
    body: { email, password: PASSWORD },
  });
  assert.equal(res.status, 200);
  return cookiesOf(res.headers)[COOKIE_NAMES.refresh];
}
const refreshCall = (refresh, extraCookie = '') =>
  call('/api/auth/refresh', {
    method: 'POST',
    session:
      refresh === undefined
        ? undefined
        : { cookie: `${COOKIE_NAMES.refresh}=${refresh}${extraCookie}` },
  });
const rowOf = async (refresh) =>
  (
    await pool.query(
      'SELECT id, family_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1',
      [sha256(refresh)],
    )
  ).rows[0];
const assertDenied = (res) => {
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, ERR.UNAUTHORIZED.code);
  assert.deepEqual(res.headers.getSetCookie(), []); // 실패해도 쿠키를 지우지 않는다(AD-14)
};
const pushRevokedPast = (refresh, seconds) =>
  pool.query(
    `UPDATE refresh_tokens SET created_at = now() - interval '1 hour', revoked_at = now() - make_interval(secs => $2)
     WHERE token_hash = $1`,
    [sha256(refresh), seconds],
  );

test('AC-22: 만료된 액세스 토큰과 유효한 리프레시 쿠키로 갱신하면 200이고 새 쿠키 2개로 상태 변경이 성공한다', async () => {
  const { userId, refresh } = await signupUser();
  const expired = jwt.sign({}, config.jwtSecret, {
    algorithm: 'HS384',
    subject: userId,
    jwtid: 'expired-jti',
    expiresIn: -10,
  });
  const res = await refreshCall(refresh, `; ${COOKIE_NAMES.access}=${expired}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
  const fresh = cookiesOf(res.headers);
  for (const name of Object.values(COOKIE_NAMES)) assert.ok(fresh[name], name);
  assert.notEqual(fresh[COOKIE_NAMES.access], expired);
  assert.notEqual(fresh[COOKIE_NAMES.refresh], refresh);

  const session = { cookie: `${COOKIE_NAMES.access}=${fresh[COOKIE_NAMES.access]}` };
  const patched = await call('/api/users/me', {
    method: 'PATCH',
    session,
    body: { timezone: 'UTC' },
  });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.timezone, 'UTC');
});

test('BR-16: 갱신하면 이전 행은 폐기되고 같은 계열의 새 행이 약 7일 뒤 만료로 생기며, 이전 값 재사용은 401이다', async () => {
  const { refresh } = await signupUser();
  const before = await rowOf(refresh);
  const startedAt = Date.now();
  const res = await refreshCall(refresh);
  const next = cookiesOf(res.headers)[COOKIE_NAMES.refresh];

  const old = await rowOf(refresh);
  const created = await rowOf(next);
  assert.notEqual(old.revoked_at, null);
  assert.equal(created.revoked_at, null);
  assert.equal(created.family_id, before.family_id);
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  assert.ok(Math.abs(created.expires_at.getTime() - (startedAt + sevenDays)) < 60_000);

  assertDenied(await refreshCall(refresh));
});

test('AC-23: 쿠키 없음·모르는 값·만료된 행으로 갱신하면 401 UNAUTHORIZED다', async () => {
  assertDenied(await refreshCall(undefined));
  assertDenied(await refreshCall('not-a-known-token'));

  const { refresh } = await signupUser();
  await pool.query(
    // CHECK(expires_at > created_at) 때문에 발급 시각도 함께 과거로 옮긴다
    "UPDATE refresh_tokens SET created_at = now() - interval '8 days', expires_at = now() - interval '1 second' WHERE token_hash = $1",
    [sha256(refresh)],
  );
  assertDenied(await refreshCall(refresh));
  assert.equal((await rowOf(refresh)).revoked_at, null); // 만료는 폐기 처리하지 않고 거부만 한다
});

test('AC-24: 유예를 넘긴 폐기 토큰이 오면 401이고 그 계열 최신 값도 거부되며 다른 계열은 유효하다', async () => {
  const { refresh: first } = await signupUser();
  const otherDevice = await loginRefresh();
  const latest = cookiesOf((await refreshCall(first)).headers)[COOKIE_NAMES.refresh];
  await pushRevokedPast(first, config.refreshReuseGraceMs / 1000 + 1);

  const logs = [];
  const spy = mock.method(console, 'log', (line) => logs.push(JSON.parse(line)));
  let reused;
  try {
    reused = await api.request('/api/auth/refresh', {
      method: 'POST',
      session: { cookie: `${COOKIE_NAMES.refresh}=${first}` },
    });
    await new Promise((r) => setImmediate(r));
  } finally {
    spy.mock.restore();
  }
  assertDenied(reused);
  assert.ok(logs.some((l) => l.level === 'error' && /재사용/.test(l.message)));
  assert.ok(!JSON.stringify(logs).includes(first));

  assert.notEqual((await rowOf(latest)).revoked_at, null);
  assertDenied(await refreshCall(latest));
  assert.equal((await refreshCall(otherDevice)).status, 200);
});

test('OI-20: 폐기 직후(유예 안)의 이전 값은 401이지만 계열을 폐기하지 않아 최신 값으로 갱신된다', async () => {
  const { refresh: first } = await signupUser();
  const latest = cookiesOf((await refreshCall(first)).headers)[COOKIE_NAMES.refresh];
  assertDenied(await refreshCall(first));
  assert.equal((await rowOf(latest)).revoked_at, null);
  assert.equal((await refreshCall(latest)).status, 200);
});

test('OI-20: 같은 값으로 동시에 2건 갱신하면 1건만 성공하고, 성공한 쪽의 새 값으로 이후 갱신이 된다', async () => {
  const { refresh } = await signupUser();
  const results = await Promise.all([refreshCall(refresh), refreshCall(refresh)]);
  const ok = results.filter((r) => r.status === 200);
  const denied = results.filter((r) => r.status === 401);
  assert.equal(ok.length, 1);
  assert.equal(denied.length, 1);
  assert.equal(denied[0].body.error.code, ERR.UNAUTHORIZED.code);

  const winner = cookiesOf(ok[0].headers)[COOKIE_NAMES.refresh];
  assert.equal((await refreshCall(winner)).status, 200);
});

test('NFR-10: 갱신은 액세스 토큰 없이 처리되고 실패를 반복해도 로그인 실패 횟수에 들어가지 않는다', async () => {
  const { refresh } = await signupUser();
  for (let i = 0; i < 12; i++) assertDenied(await refreshCall(`bad-${i}`));
  assert.deepEqual(size(), { ip: 0, email: 0 });
  assert.equal((await refreshCall(refresh)).status, 200); // 리프레시 쿠키만 보냈다
  assert.equal(
    (
      await call('/api/auth/login', {
        method: 'POST',
        body: { email: 'a@example.test', password: PASSWORD },
      })
    ).status,
    200,
  );
});

test('SO-17: 갱신 응답 본문과 로그에 리프레시 토큰 원문이 없다', async () => {
  const { refresh } = await signupUser();
  const res = await refreshCall(refresh);
  const next = cookiesOf(res.headers)[COOKIE_NAMES.refresh];
  const dump = res.text + JSON.stringify(res.logs);
  for (const secret of [refresh, next]) assert.ok(!dump.includes(secret));
});

test('AC-23: 로그아웃으로 폐기된 리프레시 값으로 갱신하면 유예와 상관없이 401이다(AC-16)', async () => {
  const { refresh } = await signupUser();
  const out = await call('/api/auth/logout', {
    method: 'POST',
    session: { cookie: `${COOKIE_NAMES.refresh}=${refresh}` },
  });
  assert.equal(out.status, 200);
  assert.notEqual((await rowOf(refresh)).revoked_at, null);
  assertDenied(await refreshCall(refresh)); // 폐기 직후(유예 안)
  await pushRevokedPast(refresh, config.refreshReuseGraceMs / 1000 + 1);
  assertDenied(await refreshCall(refresh)); // 유예 밖
});
