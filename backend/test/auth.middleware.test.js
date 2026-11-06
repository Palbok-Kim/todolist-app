import { test, mock, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../src/config.js';
import { pool } from '../src/db/pool.js';
import { ERR } from '../src/errors.js';
import { COOKIE_NAMES } from '../src/lib/cookies.js';
import { issueSessionTokens } from '../src/lib/token.js';
import { startApp } from './helpers/api.js';

let api;
before(async () => {
  api = await startApp();
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

const cookieOf = (access) => `${COOKIE_NAMES.access}=${access}`;

// authenticate는 DB를 조회하지 않으므로 사용자 행 없이 토큰만 만든다
function validSession() {
  const userId = randomUUID();
  const t = issueSessionTokens(userId);
  return {
    userId,
    session: { cookie: cookieOf(t.accessToken) },
  };
}

function expiredSession() {
  const userId = randomUUID();
  const jti = randomUUID();
  const token = jwt.sign({}, config.jwtSecret, {
    algorithm: 'HS384',
    subject: userId,
    jwtid: jti,
    expiresIn: -10,
  });
  return { token, session: { cookie: cookieOf(token) } };
}

const infoLog = (logs) => logs.find((l) => l.level === 'info');

test('AC-02: 토큰 없는 /api 요청은 401 UNAUTHORIZED이고 fields가 없다', async () => {
  const { status, body } = await call('/api/nope');
  assert.equal(status, 401);
  assert.equal(body.error.code, ERR.UNAUTHORIZED.code);
  assert.equal(body.error.message, '로그인이 필요합니다.');
  assert.equal(body.error.fields, undefined);
});

test('NFR-07: 만료 토큰은 401이다', async () => {
  const { session } = expiredSession();
  const res = await call('/api/nope', { method: 'POST', session });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, ERR.UNAUTHORIZED.code);
});

test('AC-02: 위조된 액세스 쿠키 값은 401 UNAUTHORIZED이다', async () => {
  const { status, body } = await call('/api/nope', {
    session: { cookie: `${COOKIE_NAMES.access}=garbage` },
  });
  assert.equal(status, 401);
  assert.equal(body.error.code, ERR.UNAUTHORIZED.code);
});

test('DL-05: 유효 토큰이면 GET·POST·PUT·PATCH·DELETE가 미들웨어를 통과하고 로그 userId는 JWT sub이다', async () => {
  const { userId, session } = validSession();
  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
    const { status, body, logs } = await call('/api/nope', { method, session });
    assert.equal(status, 404, method);
    assert.equal(body.error.code, ERR.NOT_FOUND.code);
    assert.equal(infoLog(logs).userId, userId);
  }
});

test('DL-05: GET /api/health는 인증 없이 200이다', async () => {
  const { status, body } = await call('/api/health');
  assert.equal(status, 200);
  assert.deepEqual(body, { status: 'ok', db: 'up' });
});

// 토큰 갱신이 authenticate를 거치지 않는지는 test/refresh.test.js가 실제 리프레시 쿠키로 확인한다
test('DL-05: 비인증 요청 로그의 userId는 null이다', async () => {
  const { logs } = await call('/api/nope');
  assert.equal(infoLog(logs).userId, null);
});
