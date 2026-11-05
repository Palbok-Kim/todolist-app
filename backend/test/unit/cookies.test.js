import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config } from '../../src/config.js';
import { COOKIE_NAMES, setSessionCookies, clearSessionCookies } from '../../src/lib/cookies.js';

const BACKEND_DIR = fileURLToPath(new URL('../../', import.meta.url));
const TOKENS = { accessToken: 'a', refreshToken: 'r', csrfToken: 'c' };

const app = express();
app.get('/set', (req, res) => {
  setSessionCookies(res, TOKENS, req.query.secure === '1');
  res.end();
});
app.get('/clear', (req, res) => {
  clearSessionCookies(res, false);
  res.end();
});
app.get('/default', (req, res) => {
  setSessionCookies(res, TOKENS);
  res.end();
});

// 쿠키 이름 → { value, 속성(소문자 키) }
async function cookiesOf(path) {
  const server = app.listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`);
    const out = {};
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(';').map((s) => s.trim());
      const [name, value] = pair.split('=');
      const parsed = { value };
      for (const a of attrs) {
        const [k, v = true] = a.split('=');
        parsed[k.toLowerCase()] = v;
      }
      out[name] = parsed;
    }
    return out;
  } finally {
    server.close();
  }
}

test('SO-04: 쿠키 이름은 access_token·refresh_token·csrf_token이다', () => {
  assert.deepEqual(COOKIE_NAMES, {
    access: 'access_token',
    refresh: 'refresh_token',
    csrf: 'csrf_token',
  });
});

test('SO-04: 액세스 쿠키는 HttpOnly·Lax·Path=/api·Max-Age=900이다', async () => {
  const c = (await cookiesOf('/set?secure=0')).access_token;
  assert.equal(c.value, 'a');
  assert.equal(c.httponly, true);
  assert.equal(c.samesite.toLowerCase(), 'lax');
  assert.equal(c.path, '/api');
  assert.equal(c['max-age'], '900');
});

test('SO-04: 리프레시 쿠키는 HttpOnly·Strict·Path=/api/auth·Max-Age=604800이다', async () => {
  const c = (await cookiesOf('/set?secure=0')).refresh_token;
  assert.equal(c.value, 'r');
  assert.equal(c.httponly, true);
  assert.equal(c.samesite.toLowerCase(), 'strict');
  assert.equal(c.path, '/api/auth');
  assert.equal(c['max-age'], '604800');
});

test('SO-04: CSRF 쿠키는 HttpOnly가 아니고 Lax·Path=/·Max-Age=900이다', async () => {
  const c = (await cookiesOf('/set?secure=0')).csrf_token;
  assert.equal(c.value, 'c');
  assert.equal(c.httponly, undefined);
  assert.equal(c.samesite.toLowerCase(), 'lax');
  assert.equal(c.path, '/');
  assert.equal(c['max-age'], '900');
});

test('SO-04: secure 인자에 따라 세 쿠키 모두 Secure가 붙거나 빠진다', async () => {
  const on = await cookiesOf('/set?secure=1');
  const off = await cookiesOf('/set?secure=0');
  for (const name of Object.values(COOKIE_NAMES)) {
    assert.equal(on[name].secure, true);
    assert.equal(off[name].secure, undefined);
  }
});

test('SO-04: test 환경의 기본값은 Secure가 없다', async () => {
  assert.equal(config.cookieSecure, false);
  const c = await cookiesOf('/default');
  for (const name of Object.values(COOKIE_NAMES)) assert.equal(c[name].secure, undefined);
});

test('SO-12: 삭제는 세 쿠키를 같은 Path로 만료시킨다', async () => {
  const c = await cookiesOf('/clear');
  const paths = { access_token: '/api', refresh_token: '/api/auth', csrf_token: '/' };
  for (const [name, path] of Object.entries(paths)) {
    assert.equal(c[name].path, path);
    const expired = c[name]['max-age'] === '0' || /1970/.test(c[name].expires ?? '');
    assert.ok(expired, `${name}이(가) 만료되지 않았다`);
  }
});

test('SO-04: production에서만 cookieSecure가 true다', () => {
  const run = (nodeEnv) =>
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        "import('./src/config.js').then(m=>console.log(m.config.cookieSecure))",
      ],
      {
        cwd: BACKEND_DIR,
        env: {
          NODE_ENV: nodeEnv,
          DATABASE_URL: 'postgres://x@localhost/x',
          JWT_SECRET: crypto.randomBytes(48).toString('base64url'),
          CSRF_SECRET: crypto.randomBytes(48).toString('base64url'),
          TRUST_PROXY: 'loopback',
        },
        encoding: 'utf8',
      },
    ).trim();
  assert.equal(run('production'), 'true');
  assert.equal(run('development'), 'false');
});
