import { test, mock, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db/pool.js';
import { COOKIE_NAMES } from '../src/lib/cookies.js';
import { startApp } from './helpers/api.js';
import { resetDb } from './helpers/db.js';

// 테스트 환경의 허용 출처는 기본값 http://localhost:5173
const APP = 'http://localhost:5173';
const EVIL = 'https://evil.example';

let api;
before(async () => {
  api = await startApp();
});
beforeEach(() => resetDb(pool));
after(async () => {
  await api.close();
  await pool.end();
});

async function raw(path, init = {}) {
  const spy = mock.method(console, 'log', () => {});
  try {
    const res = await fetch(api.baseUrl + path, init);
    await res.text();
    await new Promise((r) => setImmediate(r));
    return res;
  } finally {
    spy.mock.restore();
  }
}
const preflight = (origin, path = '/api/todos', method = 'POST') =>
  raw(path, {
    method: 'OPTIONS',
    headers: {
      origin,
      'access-control-request-method': method,
      'access-control-request-headers': 'content-type,x-csrf-token',
    },
  });

test('CORS: 허용 출처의 사전 요청은 인증 없이 204이고 쿠키·CSRF 헤더 사용을 허용한다', async () => {
  const res = await preflight(APP);
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), APP);
  assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
  assert.match(res.headers.get('access-control-allow-methods'), /PATCH/);
  assert.match(res.headers.get('access-control-allow-headers'), /X-CSRF-Token/i);
  assert.match(res.headers.get('vary'), /Origin/);
});

test('CORS: 허용하지 않은 출처는 사전 요청·본 요청 모두 CORS 헤더가 없다', async () => {
  const pre = await preflight(EVIL);
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-origin'), null);
  assert.equal(pre.headers.get('access-control-allow-methods'), null);
  const res = await raw('/api/health', { headers: { origin: EVIL } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
  assert.equal(res.headers.get('access-control-allow-credentials'), null);
});

test('CORS: 허용 출처의 본 요청(가입)은 출처를 되돌려 주고 쿠키를 발급한다', async () => {
  const res = await raw('/api/auth/signup', {
    method: 'POST',
    headers: { origin: APP, 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'cors@example.test',
      password: 'correct horse battery staple 1!',
      name: '홍길동',
    }),
  });
  assert.equal(res.status, 201);
  assert.equal(res.headers.get('access-control-allow-origin'), APP);
  assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
  const names = res.headers.getSetCookie().map((c) => c.split('=')[0]);
  for (const n of Object.values(COOKIE_NAMES)) assert.ok(names.includes(n), n);
});

test('CORS: 허용하지 않은 출처에서 쿠키를 실어 보내도 CSRF 헤더 없이는 상태 변경이 403이다', async () => {
  const signup = await raw('/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'csrf@example.test',
      password: 'correct horse battery staple 1!',
      name: '홍길동',
    }),
  });
  const cookie = signup.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  const res = await raw('/api/categories', {
    method: 'POST',
    headers: { origin: EVIL, cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ name: '탈취' }),
  });
  assert.equal(res.status, 403);
});
