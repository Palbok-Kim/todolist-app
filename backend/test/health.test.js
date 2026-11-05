import { test, mock, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db/pool.js';
import { ERR } from '../src/errors.js';
import { startApp } from './helpers/api.js';
import { resetDb } from './helpers/db.js';

let api;
before(async () => {
  await resetDb(pool);
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
    return { ...res, type: res.headers.get('content-type'), logs };
  } finally {
    spy.mock.restore();
  }
}

const notFound = { error: { code: ERR.NOT_FOUND.code, message: '대상을 찾을 수 없습니다.' } };

test('GET /api/health는 DB 확인 후 200 { status: ok }만 준다', async () => {
  const { status, type, body } = await call('/api/health');
  assert.equal(status, 200);
  assert.match(type, /application\/json/);
  assert.deepEqual(body, { status: 'ok' });
});

test('AC-02: 인증 없이 없는 /api 경로는 GET·POST 모두 401 UNAUTHORIZED 공통 형식이다', async () => {
  for (const method of ['GET', 'POST']) {
    const { status, body } = await call('/api/nope', { method });
    assert.equal(status, 401);
    assert.deepEqual(body, {
      error: { code: ERR.UNAUTHORIZED.code, message: '로그인이 필요합니다.' },
    });
  }
});

test('/api 밖 경로도 404 NOT_FOUND 공통 형식이다', async () => {
  const { status, body } = await call('/health');
  assert.equal(status, 404);
  assert.deepEqual(body, notFound);
});

test('DB 실패 시 500 INTERNAL_ERROR이고 내부 정보는 로그에만 있다', async (t) => {
  t.mock.method(pool, 'query', async () => {
    throw Object.assign(new Error('terminating connection due to administrator command'), {
      code: '57P01',
    });
  });
  const { status, body, text, logs } = await call('/api/health');
  assert.equal(status, 500);
  assert.equal(body.error.code, ERR.INTERNAL_ERROR.code);
  for (const leak of ['terminating', '57P01', 'stack', 'select']) assert.ok(!text.includes(leak));
  const errLog = logs.find((l) => l.level === 'error');
  assert.match(errLog.message, /terminating connection/);
});

test('유휴 클라이언트 error 이벤트가 프로세스를 죽이지 않는다', () => {
  assert.ok(pool.listenerCount('error') > 0);
  assert.doesNotThrow(() => pool.emit('error', new Error('idle client')));
});

test('잘못된 JSON 본문은 라우트보다 먼저 400 VALIDATION_ERROR이다', async () => {
  // request()는 본문을 직렬화하므로 깨진 JSON은 fetch로 직접 보낸다
  // JSON 파서가 authenticate보다 앞이라 인증 없는 /api/nope도 401이 아니라 400이다
  const res = await fetch(`${api.baseUrl}/api/nope`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{bad',
  });
  const status = res.status;
  const body = await res.json();
  assert.equal(status, 400);
  assert.equal(body.error.code, ERR.VALIDATION_ERROR.code);
});
