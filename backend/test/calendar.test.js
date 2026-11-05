import { test, mock, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db/pool.js';
import { ERR } from '../src/errors.js';
import { TODO_STATUS } from '../src/db/todoStatus.js';
import { startApp, signup } from './helpers/api.js';
import { resetDb } from './helpers/db.js';

let api;
before(async () => {
  api = await startApp();
});
beforeEach(() => resetDb(pool));
after(async () => {
  await api.close();
  await pool.end();
});

// 요청 로그가 테스트 출력에 섞이지 않게 console.log를 잠시 막는다
async function quiet(fn) {
  const spy = mock.method(console, 'log', () => {});
  try {
    const res = await fn();
    await new Promise((r) => setImmediate(r)); // finish 이벤트의 요청 로그를 기다린다
    return res;
  } finally {
    spy.mock.restore();
  }
}

const register = (email = 'a@example.test') =>
  quiet(() => signup(api, { email, password: 'correct horse battery staple 1!', name: '홍길동' }));
const req = (path, init) => quiet(() => api.request(path, init));
async function create(session, title, startDate, endDate) {
  const res = await req('/api/todos', {
    method: 'POST',
    session,
    body: { title, startDate, endDate },
  });
  assert.equal(res.status, 201, res.text);
  return res.body;
}
const calendar = (session, from, to) =>
  req(`/api/calendar/todos?from=${from}&to=${to}`, { session });
const titles = (res) => res.body.items.map((t) => t.title);

test('AC-12: 11-03~11-05 할일은 11-03~11-05 조회에 나오고 11-06~11-30 조회에는 나오지 않는다', async () => {
  const a = await register();
  await create(a, '3일간', '2026-11-03', '2026-11-05');
  const hit = await calendar(a, '2026-11-03', '2026-11-05');
  assert.equal(hit.status, 200);
  assert.deepEqual(titles(hit), ['3일간']);
  assert.ok(Object.values(TODO_STATUS).includes(hit.body.items[0].status));
  assert.equal(hit.body.items[0].userId, undefined);
  assert.deepEqual((await calendar(a, '2026-11-06', '2026-11-30')).body.items, []);
});

test('BR-12: 기간과 겹치기만 해도 나오고 완료한 할일도 나온다', async () => {
  const a = await register();
  await create(a, '앞에 걸침', '2026-10-28', '2026-11-02');
  await create(a, '뒤에 걸침', '2026-11-30', '2026-12-10');
  await create(a, '감쌈', '2026-10-01', '2026-12-31');
  await create(a, '앞 바깥', '2026-10-01', '2026-10-31');
  const done = await create(a, '완료', '2026-11-10', '2026-11-10');
  await req(`/api/todos/${done.id}`, { method: 'PATCH', session: a, body: { completed: true } });

  const res = await calendar(a, '2026-11-02', '2026-11-30');
  assert.deepEqual(titles(res), ['앞에 걸침', '완료', '뒤에 걸침', '감쌈']);
  assert.equal(res.body.items[1].status, TODO_STATUS.COMPLETED);
});

test('BR-02: 기간 조회에도 다른 사용자의 할일이 나오지 않는다', async () => {
  const a = await register();
  const b = await register('b@example.test');
  await create(a, 'A 할일', '2026-11-03', '2026-11-05');
  await create(b, 'B 할일', '2026-11-03', '2026-11-05');
  assert.deepEqual(titles(await calendar(a, '2026-11-01', '2026-11-30')), ['A 할일']);
});

test('AQ-07: 형식 오류·누락·from > to·42일 초과는 400 VALIDATION_ERROR다', async () => {
  const a = await register();
  const cases = [
    ['?from=2026-13-01&to=2026-11-30', ['from']],
    ['?from=2026-11-01&to=2026-11-31', ['to']],
    ['?from=2026-11-01', ['to']],
    ['', ['from', 'to']],
    ['?from=20261101&to=2026-11-30', ['from']],
    ['?from=2026-11-05&to=2026-11-04', ['to']],
    ['?from=2026-10-26&to=2026-12-07', ['to']], // 43일
    ['?from=0000-01-01&to=0000-01-02', ['from', 'to']], // PostgreSQL에 0년 없음
    ['?from=0001-01-01&to=0100-01-01', ['to']], // Date.UTC의 0~99년 보정 확인
  ];
  for (const [q, expected] of cases) {
    const res = await req(`/api/calendar/todos${q}`, { session: a });
    assert.equal(res.status, 400, q);
    assert.equal(res.body.error.code, ERR.VALIDATION_ERROR.code);
    assert.deepEqual(
      res.body.error.fields.map((f) => f.field),
      expected,
      q,
    );
  }
});

test('AQ-07: 양 끝 포함 42일과 하루 조회는 허용한다', async () => {
  const a = await register();
  assert.equal((await calendar(a, '2026-10-26', '2026-12-06')).status, 200);
  assert.equal((await calendar(a, '2026-11-03', '2026-11-03')).status, 200);
  assert.equal((await calendar(a, '2026-12-20', '2027-01-30')).status, 200); // 연도 경계 42일
});

test('AC-02: 인증 없이 기간 조회하면 401이다', async () => {
  assert.equal((await calendar(undefined, '2026-11-01', '2026-11-30')).status, 401);
});
