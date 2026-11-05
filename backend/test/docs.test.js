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

test('개발 환경에서 /api/docs는 인증 없이 Swagger UI와 명세를 준다', async () => {
  const page = await quiet(() => api.request('/api/docs'));
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.match(page.text, /SwaggerUIBundle/);
  const spec = await quiet(() => api.request('/api/docs/swagger.yaml'));
  assert.equal(spec.status, 200);
  assert.match(spec.text, /^openapi: 3\.0\.3$/m);
});
