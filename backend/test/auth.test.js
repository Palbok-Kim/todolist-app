// BE-14: 인증 AC를 사용자 흐름 그대로 묶은 통합 테스트. 세부 경계값은 signup·login·auth.middleware 테스트에 있다
import { test, mock, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../src/config.js';
import { pool } from '../src/db/pool.js';
import { ERR } from '../src/errors.js';
import { COOKIE_NAMES } from '../src/lib/cookies.js';
import { EMAIL_LIMIT, reset } from '../src/lib/loginAttempts.js';
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

const PASSWORD = 'correct horse battery staple';
const EMAIL = 'a@example.test';
// 보호 라우트 대표로 내 정보 조회를 쓴다(인증되면 200, 아니면 401)
const PROTECTED = '/api/users/me';

const signupCall = (email = EMAIL) =>
  call('/api/auth/signup', { method: 'POST', body: { email, password: PASSWORD, name: '홍길동' } });
const loginCall = (email = EMAIL, password = PASSWORD) =>
  call('/api/auth/login', { method: 'POST', body: { email, password } });
const logoutCall = (session) => call('/api/auth/logout', { method: 'POST', session });

const cookieValue = (headers, name) =>
  headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .find((p) => p.startsWith(`${name}=`))
    ?.slice(name.length + 1);
const sha256 = (v) => createHash('sha256').update(v).digest('hex');
const familyRows = async (refreshToken) =>
  (
    await pool.query(
      `SELECT revoked_at FROM refresh_tokens
       WHERE family_id = (SELECT family_id FROM refresh_tokens WHERE token_hash = $1)`,
      [sha256(refreshToken)],
    )
  ).rows;

function assertCookiesCleared(headers) {
  const lines = headers.getSetCookie();
  for (const name of Object.values(COOKIE_NAMES)) {
    const line = lines.find((c) => c.startsWith(`${name}=`));
    assert.ok(line, name);
    assert.ok(/Expires=Thu, 01 Jan 1970|Max-Age=0/.test(line), line);
  }
}

async function assertLoggedOut() {
  const res = await call(PROTECTED); // 쿠키가 지워진 브라우저처럼 쿠키 없이 요청한다
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, ERR.UNAUTHORIZED.code);
}

test('AC-01: 회원가입하면 기본 카테고리가 정확히 1개 생기고 바로 로그인 상태다', async () => {
  const res = await signupCall();
  assert.equal(res.status, 201);
  const { rows } = await pool.query(
    'SELECT name FROM categories WHERE user_id = $1 AND is_default',
    [res.body.id],
  );
  assert.deepEqual(rows, [{ name: '기본' }]);
  assert.equal((await call(PROTECTED, { session: sessionFrom(res.headers) })).status, 200);
});

test('AC-02: 로그인하지 않은 상태로 할일 목록에 접근하면 401 UNAUTHORIZED다', async () => {
  const res = await call(PROTECTED);
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, ERR.UNAUTHORIZED.code);
  assert.equal(res.body.error.message, '로그인이 필요합니다.');
});

test('AC-14: 틀린 비밀번호와 없는 이메일은 같은 401 본문이고 쿠키를 주지 않는다', async () => {
  await signupCall();
  const wrong = await loginCall(EMAIL, 'wrong password 123');
  const unknown = await loginCall('b@example.test', 'wrong password 123');
  assert.equal(wrong.status, 401);
  assert.equal(wrong.body.error.code, ERR.INVALID_CREDENTIALS.code);
  assert.deepEqual(unknown.body, wrong.body);
  assert.equal(unknown.status, wrong.status);
  assert.deepEqual(wrong.headers.getSetCookie(), []);
  assert.deepEqual(unknown.headers.getSetCookie(), []);
});

test('AC-15: 같은 계정으로 한도만큼 실패하면 올바른 비밀번호도 429이고 세션을 만들지 않는다', async () => {
  await signupCall();
  for (let i = 0; i < EMAIL_LIMIT; i++)
    assert.equal((await loginCall(EMAIL, 'wrong password 123')).status, 401);
  const before = (await pool.query('SELECT count(*)::int AS n FROM refresh_tokens')).rows[0].n;

  const res = await loginCall();
  assert.equal(res.status, 429);
  assert.equal(res.body.error.code, ERR.TOO_MANY_REQUESTS.code);
  assert.deepEqual(res.headers.getSetCookie(), []);
  const after = (await pool.query('SELECT count(*)::int AS n FROM refresh_tokens')).rows[0].n;
  assert.equal(after, before);
  // 시간 창이 지나면 다시 로그인되는 부분은 BE-09 단위 테스트(XQ-05)
});

test('AC-16: 로그인한 상태에서 로그아웃하면 200, 쿠키 삭제, 계열 폐기, 이후 보호 라우트는 401이다', async () => {
  await signupCall();
  const login = await loginCall();
  const refresh = cookieValue(login.headers, COOKIE_NAMES.refresh);

  const res = await logoutCall(sessionFrom(login.headers));
  assert.equal(res.status, 200);
  assertCookiesCleared(res.headers);
  const rows = await familyRows(refresh);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.revoked_at !== null));
  await assertLoggedOut();
});

test('AC-16: 쿠키 없이 로그아웃해도 200이고 쿠키를 지우며 이후 보호 라우트는 401이다', async () => {
  const res = await logoutCall();
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
  assertCookiesCleared(res.headers);
  await assertLoggedOut();
});

test('AC-16: 액세스 토큰이 만료된 상태로 로그아웃해도 200이고 계열을 폐기하며 이후 보호 라우트는 401이다', async () => {
  const signup = await signupCall();
  const refresh = cookieValue(signup.headers, COOKIE_NAMES.refresh);
  const expired = jwt.sign({}, config.jwtSecret, {
    algorithm: 'HS384',
    subject: signup.body.id,
    expiresIn: -10,
  });
  const session = {
    cookie: `${COOKIE_NAMES.access}=${expired}; ${COOKIE_NAMES.refresh}=${refresh}`,
  };
  assert.equal((await call(PROTECTED, { session })).status, 401); // 정말 만료된 토큰인지 먼저 확인

  const res = await logoutCall(session);
  assert.equal(res.status, 200);
  assertCookiesCleared(res.headers);
  const rows = await familyRows(refresh);
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].revoked_at, null);
  await assertLoggedOut();
});
