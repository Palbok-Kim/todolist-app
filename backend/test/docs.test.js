import { test, mock, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers/api.js';

let api;
before(async () => {
  api = await startApp();
});
after(() => api.close());

// 요청 로그가 테스트 출력에 섞이지 않게 console.log를 잠시 막는다
async function quiet(fn) {
  const spy = mock.method(console, 'log', () => {});
  try {
    const res = await fn();
    await new Promise((r) => setImmediate(r));
    return res;
  } finally {
    spy.mock.restore();
  }
}

// development에서 열리는지는 npm run dev로 확인한다. 테스트(NODE_ENV=test)는 운영처럼 닫혀 있어야 한다
test('development가 아니면 /api/docs와 명세가 공개 라우트로 열리지 않는다', async () => {
  for (const path of ['/api/docs', '/api/docs/swagger.yaml']) {
    const res = await quiet(() => api.request(path));
    assert.equal(res.status, 401, path);
    assert.ok(!res.text.includes('SwaggerUIBundle'), path);
  }
});
