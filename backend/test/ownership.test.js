// QA-02, TQ-04, NFR-09: 사용자 A가 B의 ID로 호출하면 없는 ID와 똑같은 404여야 한다(BR-02, KPI-04)
//
// 엔드포인트 ↔ 교차 케이스 점검표 (할일 6 + 카테고리 4 = 10개 엔드포인트, 케이스 11개)
// | 엔드포인트                      | 교차 방식                         | 케이스 |
// | POST   /api/todos               | 본문 categoryId = B의 카테고리     | 1 |
// | GET    /api/todos               | 목록에 B 할일 0건 + ?categoryId=B  | 2 |
// | GET    /api/todos/:id           | B의 할일 ID                        | 1 |
// | PATCH  /api/todos/:id           | B의 할일 ID, 본문 categoryId = B   | 2 |
// | DELETE /api/todos/:id           | B의 할일 ID                        | 1 |
// | GET    /api/calendar/todos      | 기간 결과에 B 할일 0건             | 1 |
// | GET    /api/categories          | 목록에 B 카테고리 0건              | 1 |
// | POST   /api/categories          | ID 입력 없음(이름 중복은 사용자별, category.test.js) | 0 |
// | PATCH  /api/categories/:id      | B의 카테고리 ID                    | 1 |
// | DELETE /api/categories/:id      | B의 카테고리 ID                    | 1 |
import { test, mock, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../src/db/pool.js';
import { ERR } from '../src/errors.js';
import { startApp, signup } from './helpers/api.js';
import { resetDb } from './helpers/db.js';

let api;
let A;
let B;
const MISSING = randomUUID();

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
const req = (session, path, method = 'GET', body) =>
  quiet(() => api.request(path, { method, session, body }));

async function setupUser(email) {
  const s = await quiet(() =>
    signup(api, { email, password: 'correct horse battery staple', name: email }),
  );
  const category = (await req(s, '/api/categories', 'POST', { name: `${email} 업무` })).body;
  const todo = (
    await req(s, '/api/todos', 'POST', {
      title: `${email} 할일`,
      startDate: '2026-11-03',
      endDate: '2026-11-05',
      categoryId: category.id,
    })
  ).body;
  return { s, category, todo };
}

before(async () => {
  api = await startApp();
  await resetDb(pool);
  A = await setupUser('a@example.test');
  B = await setupUser('b@example.test');
});
after(async () => {
  await api.close();
  await pool.end();
});

const snapshot = async () =>
  (await pool.query('SELECT id, title, category_id, completed FROM todos ORDER BY id')).rows.concat(
    (await pool.query('SELECT id, name FROM categories ORDER BY id')).rows,
  );

// B의 ID 응답과 없는 ID 응답이 상태·code·message까지 같고, B의 데이터는 바뀌지 않는다
async function assertSameAsMissing(call) {
  const before = await snapshot();
  const foreign = await call(true);
  const missing = await call(false);
  assert.equal(foreign.status, 404, foreign.text);
  assert.equal(foreign.body.error.code, ERR.NOT_FOUND.code);
  assert.deepEqual(foreign.body, missing.body);
  assert.equal(foreign.status, missing.status);
  assert.deepEqual(await snapshot(), before);
}

const pick = (foreign, id) => (foreign ? id : MISSING);

test('BR-02: GET /api/todos/:id 에 B의 할일 ID는 없는 ID와 같은 404다', () =>
  assertSameAsMissing((f) => req(A.s, `/api/todos/${pick(f, B.todo.id)}`)));

test('BR-02: PATCH /api/todos/:id 에 B의 할일 ID는 없는 ID와 같은 404다', () =>
  assertSameAsMissing((f) =>
    req(A.s, `/api/todos/${pick(f, B.todo.id)}`, 'PATCH', { title: '탈취', completed: true }),
  ));

test('BR-02: DELETE /api/todos/:id 에 B의 할일 ID는 없는 ID와 같은 404다', () =>
  assertSameAsMissing((f) => req(A.s, `/api/todos/${pick(f, B.todo.id)}`, 'DELETE')));

test('BR-02: POST /api/todos 의 categoryId가 B의 카테고리면 없는 ID와 같은 404다', async () => {
  await assertSameAsMissing((f) =>
    req(A.s, '/api/todos', 'POST', {
      title: '남의 카테고리',
      startDate: '2026-11-03',
      endDate: '2026-11-03',
      categoryId: pick(f, B.category.id),
    }),
  );
});

test('BR-02: PATCH /api/todos/:id 의 categoryId가 B의 카테고리면 없는 ID와 같은 404다', () =>
  assertSameAsMissing((f) =>
    req(A.s, `/api/todos/${A.todo.id}`, 'PATCH', { categoryId: pick(f, B.category.id) }),
  ));

test('BR-02: GET /api/todos?categoryId= 가 B의 카테고리면 없는 ID와 같은 404다', () =>
  assertSameAsMissing((f) => req(A.s, `/api/todos?categoryId=${pick(f, B.category.id)}`)));

test('BR-02: PATCH /api/categories/:id 에 B의 카테고리 ID는 없는 ID와 같은 404다', () =>
  assertSameAsMissing((f) =>
    req(A.s, `/api/categories/${pick(f, B.category.id)}`, 'PATCH', { name: '탈취' }),
  ));

test('BR-02: DELETE /api/categories/:id 에 B의 카테고리 ID는 없는 ID와 같은 404다', () =>
  assertSameAsMissing((f) => req(A.s, `/api/categories/${pick(f, B.category.id)}`, 'DELETE')));

test('AC-09: 할일 목록·필터 결과에 B의 할일이 0건이다(KPI-04)', async () => {
  for (const q of ['', '?status=IN_PROGRESS', '?status=OVERDUE', `?categoryId=${A.category.id}`]) {
    const ids = (await req(A.s, `/api/todos${q}`)).body.items.map((t) => t.id);
    assert.ok(!ids.includes(B.todo.id), q);
  }
  assert.deepEqual(
    (await req(A.s, '/api/todos')).body.items.map((t) => t.id),
    [A.todo.id],
  );
});

test('AC-09: 캘린더 기간 결과에 B의 할일이 0건이다(KPI-04)', async () => {
  const items = (await req(A.s, '/api/calendar/todos?from=2026-11-01&to=2026-11-30')).body.items;
  assert.deepEqual(
    items.map((t) => t.id),
    [A.todo.id],
  );
});

test('AC-09: 카테고리 목록에 B의 카테고리가 0건이고 할일 수에도 B의 할일이 섞이지 않는다', async () => {
  const items = (await req(A.s, '/api/categories')).body.items;
  assert.ok(!items.some((c) => c.id === B.category.id));
  assert.deepEqual(
    items.map((c) => [c.name, c.todoCount]),
    [
      ['기본', 0],
      ['a@example.test 업무', 1],
    ],
  );
});
