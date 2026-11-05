import { test, mock, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db/pool.js';
import { ERR } from '../src/errors.js';
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

const register = (email) =>
  quiet(() => signup(api, { email, password: 'correct horse battery staple', name: '홍길동' }));
const list = (session) => quiet(() => api.request('/api/categories', { session }));

// 할일 생성 API는 BE-17이라 DB에 직접 넣는다
async function addCategory(userId, name) {
  const { rows } = await pool.query(
    'INSERT INTO categories (user_id, name) VALUES ($1, $2) RETURNING id',
    [userId, name],
  );
  return rows[0].id;
}
const addTodo = (userId, categoryId, title) =>
  pool.query(
    `INSERT INTO todos (user_id, category_id, title, start_date, end_date)
     VALUES ($1, $2, $3, '2026-11-05', '2026-11-06')`,
    [userId, categoryId, title],
  );

test('BR-04: 가입 직후 목록은 기본 카테고리 1개이고 할일 수가 0이다', async () => {
  const a = await register('a@example.test');
  const res = await list(a);
  assert.equal(res.status, 200);
  assert.equal(res.body.items.length, 1);
  const [only] = res.body.items;
  assert.deepEqual(Object.keys(only).sort(), ['createdAt', 'id', 'isDefault', 'name', 'todoCount']);
  assert.equal(only.name, '기본');
  assert.equal(only.isDefault, true);
  assert.equal(only.todoCount, 0);
});

test('BR-02: 다른 사용자의 카테고리와 할일 수는 내 목록에 섞이지 않는다', async () => {
  const a = await register('a@example.test');
  const b = await register('b@example.test');
  const bCat = await addCategory(b.body.id, 'B 전용');
  await addTodo(b.body.id, bCat, 'B 할일');

  const items = (await list(a)).body.items;
  assert.deepEqual(
    items.map((c) => c.name),
    ['기본'],
  );
  assert.equal(items[0].todoCount, 0);
  assert.ok(!items.some((c) => c.id === bCat));
});

test('D-11: 할일 2개를 만든 카테고리의 할일 수가 2이고 기본 카테고리가 먼저 나온다', async () => {
  const a = await register('a@example.test');
  const work = await addCategory(a.body.id, '업무');
  await addTodo(a.body.id, work, '하나');
  await addTodo(a.body.id, work, '둘');

  const items = (await list(a)).body.items;
  assert.deepEqual(
    items.map((c) => [c.name, c.todoCount]),
    [
      ['기본', 0],
      ['업무', 2],
    ],
  );
});

test('AC-02: 인증 없이 목록을 요청하면 401이다', async () => {
  const res = await list();
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, ERR.UNAUTHORIZED.code);
});

const createCall = (session, name) =>
  quiet(() => api.request('/api/categories', { method: 'POST', session, body: { name } }));
const categoryCount = async () =>
  (await pool.query('SELECT count(*)::int AS n FROM categories')).rows[0].n;

test('BR-14: 이름 앞뒤 공백을 지워 저장하고 201 Category를 주며 목록에 나온다', async () => {
  const a = await register('a@example.test');
  const res = await createCall(a, '  업무  ');
  assert.equal(res.status, 201);
  assert.deepEqual(Object.keys(res.body).sort(), ['createdAt', 'id', 'isDefault', 'name']);
  assert.equal(res.body.name, '업무');
  assert.equal(res.body.isDefault, false);
  assert.deepEqual(
    (await list(a)).body.items.map((c) => [c.name, c.todoCount]),
    [
      ['기본', 0],
      ['업무', 0],
    ],
  );
});

test('BR-14: 공백만·누락·31자 이름은 400이고 fields에 name이 있으며 행이 생기지 않는다', async () => {
  const a = await register('a@example.test');
  for (const name of ['  ', undefined, 'x'.repeat(31)]) {
    const res = await createCall(a, name);
    assert.equal(res.status, 400, String(name));
    assert.equal(res.body.error.code, ERR.VALIDATION_ERROR.code);
    assert.deepEqual(
      res.body.error.fields.map((f) => f.field),
      ['name'],
    );
  }
  assert.equal(await categoryCount(), 1);
});

test('BR-14: 업무 등록 뒤 공백이 붙거나 대소문자만 다른 이름은 409 CONFLICT다', async () => {
  const a = await register('a@example.test');
  assert.equal((await createCall(a, '업무')).status, 201);
  assert.equal((await createCall(a, 'Work')).status, 201);
  for (const name of ['업무 ', ' 업무', 'WORK', 'work']) {
    const res = await createCall(a, name);
    assert.equal(res.status, 409, name);
    assert.equal(res.body.error.code, ERR.CONFLICT.code);
    assert.deepEqual(
      res.body.error.fields.map((f) => f.field),
      ['name'],
    );
  }
  assert.equal(await categoryCount(), 3);
});

test('BR-14: 기본 카테고리 이름 기본으로 등록하면 409 CONFLICT다', async () => {
  const a = await register('a@example.test');
  const res = await createCall(a, ' 기본 ');
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, ERR.CONFLICT.code);
});

test('BR-14: 이름 중복은 사용자마다 따로 본다', async () => {
  const a = await register('a@example.test');
  const b = await register('b@example.test');
  assert.equal((await createCall(a, '업무')).status, 201);
  assert.equal((await createCall(b, '업무')).status, 201);
});

test('NFR-15: CSRF 헤더 없는 등록은 403이고, 인증 없으면 401이다', async () => {
  const a = await register('a@example.test');
  assert.equal((await createCall({ ...a, csrfToken: undefined }, '업무')).status, 403);
  assert.equal((await createCall(undefined, '업무')).status, 401);
  assert.equal(await categoryCount(), 1);
});

const renameCall = (session, id, name) =>
  quiet(() => api.request(`/api/categories/${id}`, { method: 'PATCH', session, body: { name } }));
const deleteCall = (session, id) =>
  quiet(() => api.request(`/api/categories/${id}`, { method: 'DELETE', session }));
const defaultIdOf = async (userId) =>
  (await pool.query('SELECT id FROM categories WHERE user_id = $1 AND is_default', [userId]))
    .rows[0].id;
const todoCategories = async (userId) =>
  (
    await pool.query('SELECT title, category_id FROM todos WHERE user_id = $1 ORDER BY title', [
      userId,
    ])
  ).rows.map((r) => [r.title, r.category_id]);

test('AC-03: 기본 카테고리 삭제와 이름 변경은 모두 400 VALIDATION_ERROR이고 그대로 남는다', async () => {
  const a = await register('a@example.test');
  const def = await defaultIdOf(a.body.id);
  for (const res of [await deleteCall(a, def), await renameCall(a, def, '새 이름')]) {
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, ERR.VALIDATION_ERROR.code);
    assert.equal(res.body.error.message, '기본 카테고리는 바꾸거나 삭제할 수 없습니다.');
  }
  assert.deepEqual(
    (await list(a)).body.items.map((c) => c.name),
    ['기본'],
  );
});

test('AC-04: 업무의 할일 2개는 업무 삭제 뒤 기본 카테고리에 있고 다른 카테고리 할일은 그대로다', async () => {
  const a = await register('a@example.test');
  const def = await defaultIdOf(a.body.id);
  const work = await addCategory(a.body.id, '업무');
  const home = await addCategory(a.body.id, '집');
  await addTodo(a.body.id, work, '업무1');
  await addTodo(a.body.id, work, '업무2');
  await addTodo(a.body.id, home, '집1');

  const res = await deleteCall(a, work);
  assert.equal(res.status, 204);
  assert.equal(res.text, '');
  assert.deepEqual(await todoCategories(a.body.id), [
    ['업무1', def],
    ['업무2', def],
    ['집1', home],
  ]);
  assert.deepEqual(
    (await list(a)).body.items.map((c) => [c.name, c.todoCount]),
    [
      ['기본', 2],
      ['집', 1],
    ],
  );
});

test('DL-08: 삭제 중간에 예외가 나면 할일 이동과 카테고리 삭제가 모두 롤백되고 500이다', async () => {
  const a = await register('a@example.test');
  const work = await addCategory(a.body.id, '업무');
  await addTodo(a.body.id, work, '업무1');
  await addTodo(a.body.id, work, '업무2');
  // 이동 뒤 DELETE 단계에서 실패시킨다(테스트 DB 전용 트리거)
  await pool.query(
    "CREATE OR REPLACE FUNCTION test_fail_category_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced failure'; END $$",
  );
  await pool.query(
    'CREATE TRIGGER test_fail_category_delete BEFORE DELETE ON categories FOR EACH ROW EXECUTE FUNCTION test_fail_category_delete()',
  );
  try {
    const res = await deleteCall(a, work);
    assert.equal(res.status, 500);
    assert.equal(res.body.error.code, ERR.INTERNAL_ERROR.code);
    assert.deepEqual(await todoCategories(a.body.id), [
      ['업무1', work],
      ['업무2', work],
    ]);
    assert.ok((await list(a)).body.items.some((c) => c.id === work));
  } finally {
    await pool.query('DROP TRIGGER IF EXISTS test_fail_category_delete ON categories');
    await pool.query('DROP FUNCTION IF EXISTS test_fail_category_delete()');
  }
});

test('BR-02: 다른 사용자의·없는·형식이 틀린 카테고리 삭제와 수정은 404이고 남의 것은 그대로다', async () => {
  const a = await register('a@example.test');
  const b = await register('b@example.test');
  const bWork = await addCategory(b.body.id, 'B 업무');
  for (const id of [bWork, '9c8b7a6f-5e4d-4c3b-a2f1-e0d9c8b7a6f5', 'abc']) {
    for (const res of [await deleteCall(a, id), await renameCall(a, id, '탈취')]) {
      assert.equal(res.status, 404, id);
      assert.equal(res.body.error.code, ERR.NOT_FOUND.code);
    }
  }
  assert.deepEqual(
    (await list(b)).body.items.map((c) => c.name),
    ['기본', 'B 업무'],
  );
});

test('BR-14: 이름 변경은 앞뒤 공백을 지워 저장하고, 빈 이름은 400, 중복은 409다', async () => {
  const a = await register('a@example.test');
  const work = await addCategory(a.body.id, '업무');
  await addCategory(a.body.id, '집');
  const res = await renameCall(a, work, '  회사 업무 ');
  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(res.body).sort(), ['createdAt', 'id', 'isDefault', 'name']);
  assert.equal(res.body.name, '회사 업무');
  assert.equal((await renameCall(a, work, '회사 업무')).status, 200); // 자기 이름 그대로는 허용
  assert.equal((await renameCall(a, work, '  ')).status, 400);
  for (const name of ['집', ' 기본 ']) {
    const dup = await renameCall(a, work, name);
    assert.equal(dup.status, 409, name);
    assert.equal(dup.body.error.code, ERR.CONFLICT.code);
  }
  assert.ok((await list(a)).body.items.some((c) => c.name === '회사 업무'));
});

test('SO-07: 삭제 트랜잭션의 FK 위반은 500이 아니라 404 NOT_FOUND다', async () => {
  const a = await register('a@example.test');
  const work = await addCategory(a.body.id, '업무');
  // 이동 직후 대상 카테고리에 할일이 다시 들어온 상황을 테스트 DB 전용 트리거로 만든다
  await pool.query(
    `CREATE OR REPLACE FUNCTION test_reinsert_todo() RETURNS trigger LANGUAGE plpgsql AS $$
     BEGIN
       INSERT INTO todos (user_id, category_id, title, start_date, end_date)
       VALUES (OLD.user_id, OLD.id, '늦게 온 할일', '2026-11-05', '2026-11-05');
       RETURN OLD;
     END $$`,
  );
  await pool.query(
    'CREATE TRIGGER test_reinsert_todo BEFORE DELETE ON categories FOR EACH ROW EXECUTE FUNCTION test_reinsert_todo()',
  );
  try {
    const res = await deleteCall(a, work);
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, ERR.NOT_FOUND.code);
    assert.ok((await list(a)).body.items.some((c) => c.id === work));
  } finally {
    await pool.query('DROP TRIGGER IF EXISTS test_reinsert_todo ON categories');
    await pool.query('DROP FUNCTION IF EXISTS test_reinsert_todo()');
  }
});

test('NFR-15: CSRF 헤더 없는 수정·삭제는 403이다', async () => {
  const a = await register('a@example.test');
  const work = await addCategory(a.body.id, '업무');
  const noCsrf = { ...a, csrfToken: undefined };
  assert.equal((await renameCall(noCsrf, work, '바꿈')).status, 403);
  assert.equal((await deleteCall(noCsrf, work)).status, 403);
  assert.equal(await categoryCount(), 2);
});
