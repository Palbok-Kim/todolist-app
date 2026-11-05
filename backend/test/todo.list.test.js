import { test, mock, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../src/db/pool.js';
import { ERR } from '../src/errors.js';
import { TODO_STATUS } from '../src/db/todoStatus.js';
import { getToday } from '../src/lib/today.js';
import { startApp, signup } from './helpers/api.js';
import { resetDb } from './helpers/db.js';
import { shiftDate } from './helpers/date.js';

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

const TZ = 'Asia/Seoul';
const register = (email = 'a@example.test', timezone = TZ) =>
  quiet(() =>
    signup(api, { email, password: 'correct horse battery staple 1!', name: '홍길동', timezone }),
  );
const req = (path, init) => quiet(() => api.request(path, init));
// TQ-03: 시계를 mock하지 않고 오늘 기준 상대 날짜로 만든다
async function create(session, title, startOffset, endOffset, extra = {}, tz = TZ) {
  const today = getToday(tz);
  const res = await req('/api/todos', {
    method: 'POST',
    session,
    body: {
      title,
      startDate: shiftDate(today, startOffset),
      endDate: shiftDate(today, endOffset),
      ...extra,
    },
  });
  assert.equal(res.status, 201, res.text);
  return res.body;
}
const list = (session, query = '') => req(`/api/todos${query}`, { session });
const titles = (res) => res.body.items.map((t) => t.title);

test('AC-07: 기한 초과 할일은 OVERDUE 필터에 나오고 IN_PROGRESS 필터에는 나오지 않는다', async () => {
  const a = await register();
  await create(a, '지난 일', -4, -1);
  await create(a, '오늘 일', 0, 0);
  const overdue = await list(a, '?status=OVERDUE');
  assert.equal(overdue.status, 200);
  assert.deepEqual(titles(overdue), ['지난 일']);
  assert.equal(overdue.body.items[0].status, TODO_STATUS.OVERDUE);
  assert.deepEqual(titles(await list(a, '?status=IN_PROGRESS')), ['오늘 일']);
});

test('AC-08: 경계 3건은 ①② 진행 중, ③ 시작 전이다', async () => {
  const a = await register();
  await create(a, '①', 0, 0);
  await create(a, '②', -2, 0);
  await create(a, '③', 1, 3);
  const byTitle = Object.fromEntries((await list(a)).body.items.map((t) => [t.title, t.status]));
  assert.deepEqual(byTitle, {
    '①': TODO_STATUS.IN_PROGRESS,
    '②': TODO_STATUS.IN_PROGRESS,
    '③': TODO_STATUS.NOT_STARTED,
  });
});

test('AC-09: 사용자 B의 할일은 A의 목록과 필터 결과에 없다', async () => {
  const a = await register();
  const b = await register('b@example.test');
  await create(a, 'A 할일', 0, 0);
  await create(b, 'B 할일', 0, 0);
  assert.deepEqual(titles(await list(a)), ['A 할일']);
  assert.deepEqual(titles(await list(a, '?status=IN_PROGRESS')), ['A 할일']);
  assert.ok(!(await list(a)).text.includes('userId'));
});

test('AC-13: 시간대를 Kiritimati↔Pago_Pago로 바꾸면 같은 할일의 status가 달라지고 날짜는 그대로다', async () => {
  // 두 시간대는 25시간 차이라 언제 실행해도 오늘 날짜가 하루 이상 다르다
  const K = 'Pacific/Kiritimati';
  const P = 'Pacific/Pago_Pago';
  const a = await register('a@example.test', K);
  const todo = await create(a, '키리티마티의 오늘', 0, 0, {}, K);
  const statusIn = async () => (await list(a)).body.items[0];

  const inK = await statusIn();
  assert.equal(inK.status, TODO_STATUS.IN_PROGRESS);

  const changed = await req('/api/users/me', {
    method: 'PATCH',
    session: a,
    body: { timezone: P },
  });
  assert.equal(changed.status, 200);
  const inP = await statusIn();
  assert.equal(inP.status, TODO_STATUS.NOT_STARTED);
  assert.equal(inP.startDate, todo.startDate);
  assert.equal(inP.endDate, todo.endDate);

  await req('/api/users/me', { method: 'PATCH', session: a, body: { timezone: K } });
  assert.equal((await statusIn()).status, TODO_STATUS.IN_PROGRESS);
});

test('AD-09: 허용되지 않은 status 값은 400 VALIDATION_ERROR다', async () => {
  const a = await register();
  for (const q of [
    '?status=INVALID',
    '?status=',
    '?status=overdue',
    '?status=OVERDUE&status=COMPLETED',
  ]) {
    const res = await list(a, q);
    assert.equal(res.status, 400, q);
    assert.equal(res.body.error.code, ERR.VALIDATION_ERROR.code);
    assert.deepEqual(
      res.body.error.fields.map((f) => f.field),
      ['status'],
    );
  }
});

test('FR-05: 카테고리와 상태 필터는 AND이고 완료 필터는 완료한 할일만 준다', async () => {
  const a = await register();
  const { rows } = await pool.query(
    "INSERT INTO categories (user_id, name) VALUES ($1, '업무') RETURNING id",
    [a.body.id],
  );
  const work = rows[0].id;
  await create(a, '업무 진행', 0, 1, { categoryId: work });
  await create(a, '업무 예정', 2, 3, { categoryId: work });
  await create(a, '기본 진행', 0, 1);
  const done = await create(a, '기본 완료', -1, 1);
  await req(`/api/todos/${done.id}`, { method: 'PATCH', session: a, body: { completed: true } });

  assert.deepEqual(titles(await list(a, `?categoryId=${work}`)).sort(), ['업무 예정', '업무 진행']);
  assert.deepEqual(titles(await list(a, `?categoryId=${work}&status=IN_PROGRESS`)), ['업무 진행']);
  assert.deepEqual(titles(await list(a, '?status=COMPLETED')), ['기본 완료']);
  assert.deepEqual((await list(a, `?categoryId=${work}&status=COMPLETED`)).body.items, []);
});

test('BR-11: 정렬은 endDate → startDate → createdAt 오름차순으로 고정이다', async () => {
  const a = await register();
  await create(a, 'C', 0, 5);
  await create(a, 'B', 1, 2);
  await create(a, 'A', 0, 2);
  await create(a, 'A2', 0, 2);
  assert.deepEqual(titles(await list(a, '?sort=title')), ['A', 'A2', 'B', 'C']);
});

test('BR-02: 남의·없는·형식이 틀린 categoryId 필터는 404 NOT_FOUND다', async () => {
  const a = await register();
  const b = await register('b@example.test');
  const { rows } = await pool.query('SELECT id FROM categories WHERE user_id = $1 AND is_default', [
    b.body.id,
  ]);
  for (const q of [`?categoryId=${rows[0].id}`, `?categoryId=${randomUUID()}`, '?categoryId=abc']) {
    const res = await list(a, q);
    assert.equal(res.status, 404, q);
    assert.equal(res.body.error.code, ERR.NOT_FOUND.code);
  }
});

test('AC-02: 인증 없이 목록을 요청하면 401이다', async () => {
  assert.equal((await list()).status, 401);
});
