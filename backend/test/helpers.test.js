import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import pg from 'pg';
import { pool } from '../src/db/pool.js';
import { devDatabaseUrl } from './helpers/env.js';
import { resetDb } from './helpers/db.js';
import { startApp, signup, login } from './helpers/api.js';
import { shiftDate } from './helpers/date.js';

const TABLES = ['users', 'categories', 'todos', 'refresh_tokens'];

before(() => resetDb(pool));
after(() => pool.end());

async function countRows(db) {
  const counts = {};
  for (const t of TABLES) {
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM ${t}`);
    counts[t] = rows[0].n;
  }
  return counts;
}

test('TQ-08: 테스트 DB는 todolist_test이고 마이그레이션이 적용되어 있다', async () => {
  const { rows } = await pool.query('SELECT current_database() AS name');
  assert.equal(rows[0].name, 'todolist_test');
  const mig = await pool.query('SELECT name FROM schema_migrations WHERE name = $1', [
    '001_init.sql',
  ]);
  assert.equal(mig.rowCount, 1);
});

test('TQ-08: resetDb는 네 테이블을 비우고 schema_migrations는 남긴다', async () => {
  const {
    rows: [user],
  } = await pool.query(
    `INSERT INTO users (email, password_hash, name, timezone)
     VALUES ('reset@example.com', 'x', '초기화', 'Asia/Seoul') RETURNING id`,
  );
  const {
    rows: [category],
  } = await pool.query(
    `INSERT INTO categories (user_id, name, is_default) VALUES ($1, '기본', true) RETURNING id`,
    [user.id],
  );
  await pool.query(
    `INSERT INTO todos (user_id, category_id, title, start_date, end_date)
     VALUES ($1, $2, '할일', '2026-11-04', '2026-11-04')`,
    [user.id, category.id],
  );
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at)
     VALUES ($1, gen_random_uuid(), $2, now() + interval '7 days')`,
    [user.id, 'a'.repeat(64)],
  );
  const migBefore = await pool.query('SELECT count(*)::int AS n FROM schema_migrations');
  assert.deepEqual(await countRows(pool), {
    users: 1,
    categories: 1,
    todos: 1,
    refresh_tokens: 1,
  });

  await resetDb(pool);

  assert.deepEqual(await countRows(pool), {
    users: 0,
    categories: 0,
    todos: 0,
    refresh_tokens: 0,
  });
  const migAfter = await pool.query('SELECT count(*)::int AS n FROM schema_migrations');
  assert.equal(migAfter.rows[0].n, migBefore.rows[0].n);
});

test('TQ-08: 개발 DB에는 resetDb가 거부되고 행 수가 그대로다', async () => {
  const devClient = new pg.Client({ connectionString: devDatabaseUrl });
  await devClient.connect();
  try {
    const before = await countRows(devClient);
    await assert.rejects(resetDb(devClient), /_test/);
    assert.deepEqual(await countRows(devClient), before);
  } finally {
    await devClient.end();
  }
});

test('TQ-08: DB 이름이 _test로 끝나지 않으면 TRUNCATE를 호출하지 않는다', async () => {
  const calls = [];
  const fakeDb = {
    query: async (sql) => {
      calls.push(String(sql));
      return { rows: [{ name: 'todolist' }] };
    },
  };
  await assert.rejects(resetDb(fakeDb));
  assert.ok(calls.length > 0);
  assert.ok(!calls.some((sql) => /TRUNCATE/i.test(sql)));
});

test('TQ-03: shiftDate는 UTC 기준으로 월·윤년·연 경계를 넘는다', () => {
  assert.equal(shiftDate('2026-01-31', 1), '2026-02-01');
  assert.equal(shiftDate('2028-02-28', 1), '2028-02-29');
  assert.equal(shiftDate('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDate('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftDate('2026-11-04', 0), '2026-11-04');
});

test('api 헬퍼: 세션 쿠키·CSRF 헤더·본문 파싱·실패 처리', async () => {
  const stub = express();
  stub.use(express.json());
  const issue = (status) => (req, res) => {
    if (req.body?.email === 'fail') return res.status(401).json({ error: {} });
    res.cookie('access_token', 'a1', { httpOnly: true, path: '/' });
    res.cookie('refresh_token', 'r1', { httpOnly: true, path: '/api/auth' });
    res.cookie('csrf_token', 'c1', { path: '/' });
    res.status(status).json({ ok: true });
  };
  stub.post('/api/auth/signup', issue(201));
  stub.post('/api/auth/login', issue(200));
  stub.post('/api/fail', (req, res) => res.status(400).json({ error: {} }));
  const echo = (req, res) =>
    res.json({
      cookie: req.headers.cookie ?? null,
      csrf: req.headers['x-csrf-token'] ?? null,
      body: req.body ?? null,
    });
  stub.get('/echo', echo);
  stub.post('/echo', echo);
  stub.get('/plain', (req, res) => res.send('hi'));

  const api = await startApp(stub);
  try {
    for (const session of [await signup(api, {}), await login(api, {})]) {
      for (const pair of ['access_token=a1', 'refresh_token=r1', 'csrf_token=c1']) {
        assert.ok(session.cookie.includes(pair), pair);
      }
      assert.doesNotMatch(session.cookie, /Path|HttpOnly/i);
      assert.equal(session.csrfToken, 'c1');
      assert.deepEqual(session.body, { ok: true });
    }
    const session = await login(api, {});

    const get = await api.request('/echo', { session });
    assert.equal(get.status, 200);
    assert.ok(get.body.cookie.includes('csrf_token=c1'));
    assert.equal(get.body.csrf, null);

    const post = await api.request('/echo', { method: 'POST', body: { a: 1 }, session });
    assert.equal(post.body.csrf, 'c1');
    assert.deepEqual(post.body.body, { a: 1 });

    const anon = await api.request('/echo');
    assert.equal(anon.body.cookie, null);

    const fail = await api.request('/api/fail', { method: 'POST' });
    assert.equal(fail.status, 400);
    await assert.rejects(login(api, { email: 'fail' }));
    await assert.rejects(signup(api, { email: 'fail' }));

    const plain = await api.request('/plain');
    assert.equal(plain.text, 'hi');
    assert.equal(plain.body, null);
  } finally {
    await api.close();
  }
});

test('api 헬퍼: 인자 없는 startApp은 실제 앱을 띄운다', async () => {
  const spy = mock.method(console, 'log', () => {});
  const api = await startApp();
  try {
    const res = await api.request('/api/health');
    assert.equal(res.status, 200);
  } finally {
    await api.close();
    spy.mock.restore();
  }
});
