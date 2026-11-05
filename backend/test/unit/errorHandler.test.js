import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { AppError, ERR } from '../../src/errors.js';
import { requestLogger } from '../../src/middleware/requestLogger.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';

// BE-02 임시 라우트
const app = express();
app.use(requestLogger);
app.use(express.json());
app.post('/validation', () => {
  throw new AppError(ERR.VALIDATION_ERROR, '입력값을 확인해 주세요.', [
    { field: 'endDate', message: '종료일은 시작일 이후여야 합니다.' },
  ]);
});
app.get('/boom', () => {
  throw new Error('relation "users" SELECT * FROM users at /app/src/db/x.js');
});
app.get('/http-error', () => {
  throw Object.assign(new Error('forbidden'), { status: 403, expose: true });
});
app.use(errorHandler);

async function call(path, init) {
  const server = app.listen(0);
  const logs = [];
  const spy = mock.method(console, 'log', (line) => logs.push(JSON.parse(line)));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, init);
    const body = await res.json();
    await new Promise((r) => setImmediate(r)); // finish 이벤트의 요청 로그를 기다린다
    return { status: res.status, body, text: JSON.stringify(body), logs };
  } finally {
    spy.mock.restore();
    server.close();
  }
}

test('ERR-01: AppError는 400과 공통 형식(fields 포함)이다', async () => {
  const { status, body } = await call('/validation', { method: 'POST' });
  assert.equal(status, 400);
  assert.deepEqual(body, {
    error: {
      code: ERR.VALIDATION_ERROR.code,
      message: '입력값을 확인해 주세요.',
      fields: [{ field: 'endDate', message: '종료일은 시작일 이후여야 합니다.' }],
    },
  });
});

test('NFR-11: 일반 Error는 500 ERR-07이고 내부 정보는 로그에만 있다', async () => {
  const { status, body, text, logs } = await call('/boom');
  assert.equal(status, 500);
  assert.equal(body.error.code, ERR.INTERNAL_ERROR.code);
  assert.equal(body.error.fields, undefined);
  for (const leak of ['SELECT', 'users', 'stack', '/app/', '.js']) assert.ok(!text.includes(leak));
  const errLog = logs.find((l) => l.level === 'error');
  assert.match(errLog.message, /SELECT/);
  assert.match(errLog.stack, /errorHandler\.test\.js/);
  assert.equal(errLog.path, '/boom');
});

test('잘못된 JSON 본문은 500이 아니라 ERR-01이다', async () => {
  const { status, body } = await call('/validation', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{bad',
  });
  assert.equal(status, 400);
  assert.equal(body.error.code, ERR.VALIDATION_ERROR.code);
});

test('SO-06: 요청 로그는 정해진 7개 필드만 있고 헤더·쿠키·body가 없다', async () => {
  const { logs } = await call('/validation?token=secret-q', {
    method: 'POST',
    headers: {
      authorization: 'Bearer secret-auth',
      cookie: 'access_token=secret-cookie',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ password: 'secret-body' }),
  });
  const line = logs.find((l) => l.level === 'info');
  assert.deepEqual(Object.keys(line).sort(), [
    'durationMs',
    'level',
    'method',
    'path',
    'status',
    'time',
    'userId',
  ]);
  assert.equal(typeof line.time, 'number');
  assert.equal(line.path, '/validation');
  assert.equal(line.status, 400);
  assert.ok(!JSON.stringify(logs).includes('secret'));
});

test('ERR-01: 본문 크기 초과(413)·지원하지 않는 문자셋(415)도 500이 아니라 400이고 오류 로그가 없다', async () => {
  const big = await call('/validation', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ x: 'a'.repeat(200 * 1024) }),
  });
  const charset = await call('/validation', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=latin9' },
    body: '{}',
  });
  for (const res of [big, charset]) {
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, ERR.VALIDATION_ERROR.code);
    assert.ok(!res.logs.some((l) => l.level === 'error'));
  }
});

test('ERR-01 변환은 body-parser 오류에만 적용되고 다른 http 오류는 500 ERR-07이다', async () => {
  const res = await call('/http-error');
  assert.equal(res.status, 500);
  assert.equal(res.body.error.code, ERR.INTERNAL_ERROR.code);
});
