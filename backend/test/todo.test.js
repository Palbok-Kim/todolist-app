import { test, mock, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../src/db/pool.js';
import { ERR } from '../src/errors.js';
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

const register = (email = 'a@example.test') =>
  quiet(() =>
    signup(api, {
      email,
      password: 'correct horse battery staple',
      name: '홍길동',
      timezone: 'Asia/Seoul',
    }),
  );
const req = (path, init) => quiet(() => api.request(path, init));
const create = (session, body) => req('/api/todos', { method: 'POST', session, body });
const todoCount = async () => (await pool.query('SELECT count(*)::int AS n FROM todos')).rows[0].n;
const categoryIdOf = async (userId, isDefault) =>
  (
    await pool.query('SELECT id FROM categories WHERE user_id = $1 AND is_default = $2', [
      userId,
      isDefault,
    ])
  ).rows[0]?.id;

const today = getToday('Asia/Seoul');
const base = { title: '장보기', startDate: today, endDate: today };

test('AC-05: categoryId 없이 등록하면 기본 카테고리에 들어가고 미완료로 시작한다', async () => {
  const a = await register();
  const res = await create(a, base);
  assert.equal(res.status, 201);
  assert.equal(res.body.categoryId, await categoryIdOf(a.body.id, true));
  assert.equal(res.body.completed, false);
  assert.equal(res.body.completedAt, null);
  assert.equal(res.body.description, null);
  assert.equal(res.body.status, 'IN_PROGRESS');
  assert.equal(res.body.userId, undefined);
  assert.deepEqual(Object.keys(res.body).sort(), [
    'categoryId',
    'completed',
    'completedAt',
    'createdAt',
    'description',
    'endDate',
    'id',
    'startDate',
    'status',
    'title',
    'updatedAt',
  ]);
});

test('AC-05: 내 카테고리를 지정하면 그 카테고리에 들어간다', async () => {
  const a = await register();
  const { rows } = await pool.query(
    "INSERT INTO categories (user_id, name) VALUES ($1, '업무') RETURNING id",
    [a.body.id],
  );
  const res = await create(a, {
    ...base,
    title: '  보고서  ',
    description: '1장',
    categoryId: rows[0].id,
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.categoryId, rows[0].id);
  assert.equal(res.body.title, '보고서');
  assert.equal(res.body.description, '1장');
});

test('AC-06, BR-15: 시작일이 종료일보다 늦으면 400이고 fields에 날짜 필드가 있으며 행이 생기지 않는다', async () => {
  const a = await register();
  const res = await create(a, { title: '역순', startDate: '2026-11-05', endDate: '2026-11-04' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, ERR.VALIDATION_ERROR.code);
  assert.deepEqual(
    res.body.error.fields.map((f) => f.field),
    ['endDate'],
  );
  assert.equal(await todoCount(), 0);
});

test('VR-05: 제목 누락·잘못된 날짜·형식이 틀린 categoryId는 400이고 행이 생기지 않는다', async () => {
  const a = await register();
  const res = await create(a, { startDate: '2026-02-30', endDate: today, categoryId: 'abc' });
  assert.equal(res.status, 400);
  assert.deepEqual(res.body.error.fields.map((f) => f.field).sort(), [
    'categoryId',
    'startDate',
    'title',
  ]);
  assert.equal(await todoCount(), 0);
});

test('BR-02: 다른 사용자나 없는 categoryId로 등록하면 404 NOT_FOUND이고 행이 생기지 않는다', async () => {
  const a = await register();
  const b = await register('b@example.test');
  for (const categoryId of [await categoryIdOf(b.body.id, true), randomUUID()]) {
    const res = await create(a, { ...base, categoryId });
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, ERR.NOT_FOUND.code);
  }
  assert.equal(await todoCount(), 0);
});

test('BR-02: 다른 사용자의 할일은 조회·삭제가 404이고 남아 있다', async () => {
  const a = await register();
  const b = await register('b@example.test');
  const bTodo = (await create(b, base)).body;
  assert.equal((await req(`/api/todos/${bTodo.id}`, { session: a })).status, 404);
  assert.equal((await req(`/api/todos/${bTodo.id}`, { method: 'DELETE', session: a })).status, 404);
  assert.equal((await req(`/api/todos/${bTodo.id}`, { session: b })).status, 200);
});

test('SO-07: 형식이 틀린 id 조회·삭제는 500이 아니라 404 NOT_FOUND다', async () => {
  const a = await register();
  for (const method of ['GET', 'DELETE']) {
    const res = await req('/api/todos/abc', { method, session: a });
    assert.equal(res.status, 404, method);
    assert.equal(res.body.error.code, ERR.NOT_FOUND.code);
  }
});

test('BR-10: 단건 조회는 status를 주고, 삭제하면 204이며 이후 조회·재삭제가 404다', async () => {
  const a = await register();
  const future = (
    await create(a, { ...base, startDate: shiftDate(today, 1), endDate: shiftDate(today, 2) })
  ).body;
  const got = await req(`/api/todos/${future.id}`, { session: a });
  assert.equal(got.status, 200);
  assert.equal(got.body.status, 'NOT_STARTED');
  assert.equal(got.body.id, future.id);

  const del = await req(`/api/todos/${future.id}`, { method: 'DELETE', session: a });
  assert.equal(del.status, 204);
  assert.equal(del.text, '');
  assert.equal((await req(`/api/todos/${future.id}`, { session: a })).status, 404);
  assert.equal(
    (await req(`/api/todos/${future.id}`, { method: 'DELETE', session: a })).status,
    404,
  );
  assert.equal(await todoCount(), 0);
});

test('NFR-15: CSRF 헤더 없는 등록·삭제는 403이고 데이터가 바뀌지 않는다', async () => {
  const a = await register();
  const todo = (await create(a, base)).body;
  const noCsrf = { ...a, csrfToken: undefined };
  assert.equal((await create(noCsrf, base)).status, 403);
  assert.equal(
    (await req(`/api/todos/${todo.id}`, { method: 'DELETE', session: noCsrf })).status,
    403,
  );
  assert.equal(await todoCount(), 1);
});

test('AC-02: 인증 없이 등록·조회하면 401이다', async () => {
  assert.equal((await create(undefined, base)).status, 401);
  assert.equal((await req(`/api/todos/${randomUUID()}`)).status, 401);
});

test('DL-06: 토큰은 유효해도 계정이 지워졌으면 단건 조회가 401이다', async () => {
  const a = await register();
  const todo = (await create(a, base)).body;
  await resetDb(pool);
  assert.equal((await req(`/api/todos/${todo.id}`, { session: a })).status, 401);
});

const patch = (session, id, body) => req(`/api/todos/${id}`, { method: 'PATCH', session, body });

test('BR-13: 완료로 표시하면 completedAt이 채워지고 status가 COMPLETED다', async () => {
  const a = await register();
  const todo = (await create(a, base)).body;
  const res = await patch(a, todo.id, { completed: true });
  assert.equal(res.status, 200);
  assert.equal(res.body.completed, true);
  assert.ok(!Number.isNaN(Date.parse(res.body.completedAt)));
  assert.equal(res.body.status, 'COMPLETED');
});

test('AC-10: 완료를 해제하면 completedAt이 null이고 status가 날짜로 다시 판정된다', async () => {
  const a = await register();
  const past = { ...base, startDate: shiftDate(today, -3), endDate: shiftDate(today, -1) };
  const todo = (await create(a, past)).body;
  await patch(a, todo.id, { completed: true });
  const res = await patch(a, todo.id, { completed: false });
  assert.equal(res.status, 200);
  assert.equal(res.body.completed, false);
  assert.equal(res.body.completedAt, null);
  assert.equal(res.body.status, 'OVERDUE');
});

test('AC-17: 제목과 startDate를 바꾸면 반영되고 updatedAt이 커지며 시작 전으로 판정된다', async () => {
  const a = await register();
  const todo = (await create(a, { ...base, endDate: shiftDate(today, 5) })).body;
  assert.equal(todo.status, 'IN_PROGRESS');
  const res = await patch(a, todo.id, { title: ' 바뀐 제목 ', startDate: shiftDate(today, 1) });
  assert.equal(res.status, 200);
  assert.equal(res.body.title, '바뀐 제목');
  assert.equal(res.body.startDate, shiftDate(today, 1));
  assert.equal(res.body.endDate, todo.endDate);
  assert.ok(Date.parse(res.body.updatedAt) > Date.parse(todo.updatedAt));
  assert.equal(res.body.status, 'NOT_STARTED');
  assert.equal((await req(`/api/todos/${todo.id}`, { session: a })).body.title, '바뀐 제목');
});

test('BR-07: 수정으로 end < start가 되면 400이고 기존 값이 유지된다', async () => {
  const a = await register();
  const todo = (await create(a, base)).body;
  for (const body of [{ endDate: shiftDate(today, -1) }, { startDate: shiftDate(today, 1) }]) {
    const res = await patch(a, todo.id, { title: '저장 안 됨', ...body });
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.deepEqual(
      res.body.error.fields.map((f) => f.field),
      ['endDate'],
    );
  }
  const after = (await req(`/api/todos/${todo.id}`, { session: a })).body;
  assert.deepEqual(after, todo);
});

test('VR-05: 수정 값 검증 실패·빈 본문·categoryId null은 400이고 바뀌지 않는다', async () => {
  const a = await register();
  const todo = (await create(a, base)).body;
  const cases = [
    [{ title: '   ' }, ['title']],
    [{ startDate: '2026-13-01' }, ['startDate']],
    [{ categoryId: null }, ['categoryId']],
    [{ completed: 'yes' }, ['completed']],
    [{ description: 'x'.repeat(1001) }, ['description']],
  ];
  for (const [body, expected] of cases) {
    const res = await patch(a, todo.id, body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.deepEqual(
      res.body.error.fields.map((f) => f.field),
      expected,
    );
  }
  const empty = await patch(a, todo.id, {});
  assert.equal(empty.status, 400);
  assert.equal(empty.body.error.code, ERR.VALIDATION_ERROR.code);
  assert.deepEqual((await req(`/api/todos/${todo.id}`, { session: a })).body, todo);
});

test('VR-06: description을 빈 값이나 null로 보내면 null로 저장한다', async () => {
  const a = await register();
  const todo = (await create(a, { ...base, description: '메모' })).body;
  assert.equal((await patch(a, todo.id, { description: '  ' })).body.description, null);
  await patch(a, todo.id, { description: '다시' });
  assert.equal((await patch(a, todo.id, { description: null })).body.description, null);
});

test('BR-02: 내 카테고리로는 옮겨지고, 남의·없는 카테고리나 남의 할일 수정은 404다', async () => {
  const a = await register();
  const b = await register('b@example.test');
  const todo = (await create(a, base)).body;
  const { rows } = await pool.query(
    "INSERT INTO categories (user_id, name) VALUES ($1, '업무') RETURNING id",
    [a.body.id],
  );
  assert.equal((await patch(a, todo.id, { categoryId: rows[0].id })).body.categoryId, rows[0].id);
  for (const categoryId of [await categoryIdOf(b.body.id, true), randomUUID()]) {
    const res = await patch(a, todo.id, { categoryId });
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, ERR.NOT_FOUND.code);
  }
  assert.equal((await patch(b, todo.id, { title: '남의 것' })).status, 404);
  assert.equal((await patch(a, 'abc', { title: 'x' })).status, 404);
  assert.equal((await patch(a, randomUUID(), { title: 'x' })).status, 404);
  assert.equal((await req(`/api/todos/${todo.id}`, { session: a })).body.title, base.title);
});

test('NFR-15: CSRF 헤더 없는 수정은 403이다', async () => {
  const a = await register();
  const todo = (await create(a, base)).body;
  const res = await patch({ ...a, csrfToken: undefined }, todo.id, { completed: true });
  assert.equal(res.status, 403);
});
