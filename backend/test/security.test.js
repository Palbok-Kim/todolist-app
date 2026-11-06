import { test, mock, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../src/config.js';
import { pool } from '../src/db/pool.js';
import { ERR } from '../src/errors.js';
import { COOKIE_NAMES } from '../src/lib/cookies.js';
import { EMAIL_LIMIT, IP_LIMIT, reset, size } from '../src/lib/loginAttempts.js';
import { startApp, sessionFrom } from './helpers/api.js';
import { resetDb } from './helpers/db.js';

let api;
before(async () => {
  api = await startApp();
});
beforeEach(async () => {
  await resetDb(pool);
  reset();
});
after(async () => {
  await api.close();
  await pool.end();
});

// 요청 로그를 모아 두고 테스트 출력에는 섞지 않는다
async function call(path, init) {
  const logs = [];
  const spy = mock.method(console, 'log', (line) => logs.push(line));
  try {
    const res = await api.request(path, init);
    await new Promise((r) => setImmediate(r)); // finish 이벤트의 요청 로그를 기다린다
    return { ...res, logs };
  } finally {
    spy.mock.restore();
  }
}

const PASSWORD = 'correct horse battery staple 1!';
const cookieMap = (headers) =>
  Object.fromEntries(
    headers.getSetCookie().map((c) => {
      const pair = c.split(';')[0];
      const i = pair.indexOf('=');
      return [pair.slice(0, i), pair.slice(i + 1)];
    }),
  );
async function signup(email = 'a@example.test', password = PASSWORD) {
  const res = await call('/api/auth/signup', {
    method: 'POST',
    body: { email, password, name: '홍길동' },
  });
  assert.equal(res.status, 201, res.text);
  return { id: res.body.id, ...sessionFrom(res.headers), cookies: cookieMap(res.headers) };
}
const login = (email, password) =>
  call('/api/auth/login', { method: 'POST', body: { email, password } });
const me = (cookie) => call('/api/users/me', { session: { cookie } });
const access = (token) => `${COOKIE_NAMES.access}=${token}`;

// 설정만 바꾼 자식 프로세스로 config.js를 불러 기동 가드를 본다(process.env는 쓰지 않는다)
function bootConfig(overrides) {
  const env = {
    NODE_ENV: 'test',
    DATABASE_URL: config.databaseUrl,
    JWT_SECRET: config.jwtSecret,
    ...overrides,
  };
  const url = new URL('../src/config.js', import.meta.url).href;
  return spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `await import(${JSON.stringify(url)})`],
    {
      env,
      encoding: 'utf8',
    },
  );
}
const key = (bytes) => randomBytes(bytes).toString('base64url');

// NFR-06
test('NFR-06: 73자 이상 비밀번호도 끝 글자까지 구분하고 앞뒤 공백을 지우지 않는다', async () => {
  const long = `${'a'.repeat(79)}Z`;
  await signup('long@example.test', long);
  assert.equal((await login('long@example.test', long)).status, 200);
  assert.equal((await login('long@example.test', `${'a'.repeat(79)}Y`)).status, 401);

  const spaced = '  spaced Password here  ';
  await signup('space@example.test', spaced);
  assert.equal((await login('space@example.test', spaced)).status, 200);
  assert.equal((await login('space@example.test', spaced.trim())).status, 401);
});

// NFR-07
test('NFR-07: 같은 sub·jti라도 HS384만 통과하고 HS256·none·만료·위조 토큰은 401이다', async () => {
  const user = await signup();
  const jti = randomUUID();
  const claims = { subject: user.id, jwtid: jti, expiresIn: 900 };
  const hs384 = jwt.sign({}, config.jwtSecret, { algorithm: 'HS384', ...claims });
  assert.equal((await me(access(hs384))).status, 200);

  const hs256 = jwt.sign({}, config.jwtSecret, { algorithm: 'HS256', ...claims });
  const none = jwt.sign({}, null, { algorithm: 'none', ...claims });
  const expired = jwt.sign({}, config.jwtSecret, { algorithm: 'HS384', ...claims, expiresIn: -10 });
  const otherKey = jwt.sign({}, key(48), { algorithm: 'HS384', ...claims });
  const [h, p, s] = hs384.split('.');
  const tampered = `${h}.${p}.${s.slice(0, -2)}${s.endsWith('AA') ? 'BB' : 'AA'}`;
  for (const [name, token] of Object.entries({ hs256, none, expired, otherKey, tampered })) {
    const res = await me(access(token));
    assert.equal(res.status, 401, name);
    assert.equal(res.body.error.code, ERR.UNAUTHORIZED.code, name);
  }
});

test('NFR-07: JWT 키가 47바이트면 기동을 거부하고 48바이트면 통과한다(SO-03)', () => {
  const short = bootConfig({ JWT_SECRET: key(47) });
  assert.notEqual(short.status, 0);
  assert.match(short.stderr, /JWT_SECRET/);
  assert.equal(bootConfig({ JWT_SECRET: key(48) }).status, 0);
});

test('NFR-07: 로그인 뒤 DB 어느 컬럼에도 리프레시 토큰 원문이 없다(SO-17)', async () => {
  await signup();
  const res = await login('a@example.test', PASSWORD);
  const raw = cookieMap(res.headers)[COOKIE_NAMES.refresh];
  const { rows } = await pool.query('SELECT * FROM refresh_tokens');
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.notEqual(row.token_hash, raw);
    assert.ok(!JSON.stringify(row).includes(raw));
  }
  const users = JSON.stringify((await pool.query('SELECT * FROM users')).rows);
  assert.ok(!users.includes(raw));
});

// NFR-08
test('NFR-08: 인젝션 문자열을 제목·필터·로그인 email·경로에 넣어도 5xx·데이터 손상이 없다', async () => {
  const s = await signup();
  const attack = "'; DROP TABLE todos;--";
  const created = await call('/api/todos', {
    method: 'POST',
    session: s,
    body: { title: attack, startDate: '2026-11-05', endDate: '2026-11-05' },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.title, attack); // 그대로 저장된다
  const enc = encodeURIComponent(attack);
  const responses = [
    await call(`/api/todos?status=${enc}`, { session: s }),
    await call(`/api/todos?categoryId=${enc}`, { session: s }),
    await call(`/api/calendar/todos?from=${enc}&to=2026-11-30`, { session: s }),
    await call(`/api/todos/${enc}`, { session: s }),
    await call(`/api/todos/${enc}`, { method: 'DELETE', session: s }),
    await call(`/api/categories/${enc}`, { method: 'DELETE', session: s }),
    await login(attack, 'whatever password'),
    await login(`a@example.test' OR '1'='1`, 'whatever password'),
  ];
  for (const res of responses) assert.ok(res.status < 500, `${res.status} ${res.text}`);
  const { rows } = await pool.query('SELECT title FROM todos');
  assert.deepEqual(rows, [{ title: attack }]);
});

// NFR-10
test('NFR-10: 같은 IP에서 여러 계정으로 10회 실패하면 다른 계정의 올바른 로그인도 429다', async () => {
  await signup();
  for (let i = 0; i < IP_LIMIT; i++)
    assert.equal((await login(`nobody${i}@example.test`, 'wrong password 123')).status, 401);
  const res = await login('a@example.test', PASSWORD);
  assert.equal(res.status, 429);
  assert.equal(res.body.error.code, ERR.TOO_MANY_REQUESTS.code);
});

test('NFR-10: 같은 계정 5회 실패 뒤 429이고 제한 중 시도는 횟수에 넣지 않는다', async () => {
  await signup();
  for (let i = 0; i < EMAIL_LIMIT; i++) await login('a@example.test', 'wrong password 123');
  for (let i = 0; i < 3; i++) assert.equal((await login('a@example.test', PASSWORD)).status, 429);
  assert.equal(size().email, 1);
});

test('NFR-10: 성공 로그인 20회와 토큰 갱신 실패는 제한에 들어가지 않는다', async () => {
  await signup();
  for (let i = 0; i < 20; i++) assert.equal((await login('a@example.test', PASSWORD)).status, 200);
  for (let i = 0; i < 12; i++) {
    const res = await call('/api/auth/refresh', {
      method: 'POST',
      session: { cookie: `${COOKIE_NAMES.refresh}=bad-${i}` },
    });
    assert.equal(res.status, 401);
  }
  assert.deepEqual(size(), { ip: 0, email: 0 });
  assert.equal((await login('a@example.test', PASSWORD)).status, 200);
});

test('NFR-10: production에서 로그인 제한 IP 예외 설정이 있으면 기동을 거부한다(XQ-06)', () => {
  const prod = {
    NODE_ENV: 'production',
    CORS_ORIGINS: 'https://app.example.com',
  };
  const refused = bootConfig({ ...prod, LOGIN_LIMIT_EXEMPT_IPS: '127.0.0.1' });
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /LOGIN_LIMIT_EXEMPT_IPS/);
  assert.equal(bootConfig(prod).status, 0, bootConfig(prod).stderr);
});

test('DL-05: 로그아웃과 토큰 갱신은 액세스 토큰 없이 리프레시 쿠키만으로 성공한다', async () => {
  const s = await signup();
  const refresh = await call('/api/auth/refresh', {
    method: 'POST',
    session: { cookie: `${COOKIE_NAMES.refresh}=${s.cookies[COOKIE_NAMES.refresh]}` },
  });
  assert.equal(refresh.status, 200);
  const logout = await call('/api/auth/logout', {
    method: 'POST',
    session: {
      cookie: `${COOKIE_NAMES.refresh}=${cookieMap(refresh.headers)[COOKIE_NAMES.refresh]}`,
    },
  });
  assert.equal(logout.status, 200);
});

// CORS: 허용 출처는 정확한 출처 목록이어야 한다
test('CORS: production은 CORS_ORIGINS가 없거나 출처가 아니면 기동을 거부한다', () => {
  const prod = {
    NODE_ENV: 'production',
    CORS_ORIGINS: 'https://app.example.com',
  };
  for (const [over, pattern] of [
    [{ CORS_ORIGINS: '' }, /CORS_ORIGINS/],
    [{ CORS_ORIGINS: '*' }, /CORS_ORIGINS/],
    [{ CORS_ORIGINS: 'https://app.example.com/' }, /CORS_ORIGINS/],
    [{ CORS_ORIGINS: 'https://app.example.com,app2.example.com' }, /CORS_ORIGINS/],
  ]) {
    const r = bootConfig({ ...prod, ...over });
    assert.notEqual(r.status, 0, JSON.stringify(over));
    assert.match(r.stderr, pattern);
  }
  const multi = bootConfig({
    ...prod,
    CORS_ORIGINS: 'https://app.example.com, https://m.example.com',
  });
  assert.equal(multi.status, 0, multi.stderr);
});

test('NFR-07: 토큰 유효 시간은 환경 변수로 바꿀 수 있고, 양의 정수가 아니거나 리프레시가 더 짧으면 기동을 거부한다', () => {
  for (const [over, pattern] of [
    [{ ACCESS_TOKEN_TTL_MINUTES: '0' }, /ACCESS_TOKEN_TTL_MINUTES/],
    [{ ACCESS_TOKEN_TTL_MINUTES: '15m' }, /ACCESS_TOKEN_TTL_MINUTES/],
    [{ REFRESH_TOKEN_TTL_DAYS: '-1' }, /REFRESH_TOKEN_TTL_DAYS/],
    [{ REFRESH_TOKEN_TTL_DAYS: '0.5' }, /REFRESH_TOKEN_TTL_DAYS/],
    [
      { ACCESS_TOKEN_TTL_MINUTES: '1440', REFRESH_TOKEN_TTL_DAYS: '1' }, // 하루 = 하루
      /REFRESH_TOKEN_TTL_DAYS/,
    ],
  ]) {
    const r = bootConfig(over);
    assert.notEqual(r.status, 0, JSON.stringify(over));
    assert.match(r.stderr, pattern);
  }
  const url = new URL('../src/lib/token.js', import.meta.url).href;
  const r = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `const t = await import(${JSON.stringify(url)}); console.log(t.ACCESS_TTL_SECONDS, t.REFRESH_TTL_SECONDS)`,
    ],
    {
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: config.databaseUrl,
        JWT_SECRET: config.jwtSecret,
        ACCESS_TOKEN_TTL_MINUTES: '5',
        REFRESH_TOKEN_TTL_DAYS: '1',
      },
      encoding: 'utf8',
    },
  );
  assert.equal(r.stdout.trim(), '300 86400', r.stderr);
});
