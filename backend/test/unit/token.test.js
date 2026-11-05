import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../src/config.js';
import {
  ACCESS_TTL_SECONDS,
  REFRESH_TTL_SECONDS,
  signAccessToken,
  verifyAccessToken,
  createRefreshToken,
  hashRefreshToken,
  issueSessionTokens,
} from '../../src/lib/token.js';
import { createCsrfToken, verifyCsrfToken } from '../../src/lib/csrfToken.js';

const USER_ID = '11111111-2222-4333-8444-555555555555';
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

// 디코딩 결과가 확실히 달라지도록 첫 글자를 바꾼다(끝 글자는 패딩 비트만 바뀔 수 있다)
function tamper(s) {
  return (s[0] === 'A' ? 'B' : 'A') + s.slice(1);
}

function tamperJwtSignature(token) {
  const [h, p, sig] = token.split('.');
  return `${h}.${p}.${tamper(sig)}`;
}

test('NFR-07: TTL 상수는 15분과 7일이다', () => {
  assert.equal(ACCESS_TTL_SECONDS, 900);
  assert.equal(REFRESH_TTL_SECONDS, 604800);
});

test('NFR-07: 발급한 액세스 JWT를 검증하면 sub·jti가 일치한다', () => {
  const { token, jti } = signAccessToken(USER_ID);
  assert.deepEqual(verifyAccessToken(token), { sub: USER_ID, jti });
});

test('NFR-07: 클레임은 sub·iat·exp·jti뿐이고 exp-iat는 15분, 알고리즘은 HS384다', () => {
  const { token } = signAccessToken(USER_ID);
  const { header, payload } = jwt.decode(token, { complete: true });
  assert.deepEqual(Object.keys(payload).sort(), ['exp', 'iat', 'jti', 'sub']);
  assert.equal(payload.exp - payload.iat, 900);
  assert.equal(header.alg, 'HS384');
});

test('NFR-07: 만료된 JWT는 null이다', () => {
  const expired = jwt.sign({}, config.jwtSecret, {
    algorithm: 'HS384',
    subject: 'u',
    jwtid: 'j',
    expiresIn: -10,
  });
  assert.equal(verifyAccessToken(expired), null);
});

test('NFR-07: 서명이 변조된 JWT는 null이다', () => {
  const { token } = signAccessToken(USER_ID);
  assert.equal(verifyAccessToken(tamperJwtSignature(token)), null);
});

test('NFR-07: 다른 키로 서명한 JWT는 null이다', () => {
  const other = jwt.sign({}, crypto.randomBytes(48).toString('base64url'), {
    algorithm: 'HS384',
    subject: USER_ID,
    jwtid: 'j',
    expiresIn: 900,
  });
  assert.equal(verifyAccessToken(other), null);
});

test('SO-17: 같은 키로 HS256 서명한 JWT는 null이다', () => {
  const hs256 = jwt.sign({}, config.jwtSecret, {
    algorithm: 'HS256',
    subject: USER_ID,
    jwtid: 'j',
    expiresIn: 900,
  });
  assert.equal(verifyAccessToken(hs256), null);
});

test('SO-17: alg none 토큰은 null이다', () => {
  const iat = Math.floor(Date.now() / 1000);
  const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: USER_ID, jti: 'j', iat, exp: iat + 900 })}.`;
  assert.equal(verifyAccessToken(none), null);
});

test('NFR-07: 형식이 잘못된 값은 null이다', () => {
  assert.equal(verifyAccessToken('garbage'), null);
});

test('SO-17: 리프레시 토큰은 32바이트 이상이고 해시는 원문과 다른 SHA-256 hex다', () => {
  const { token, tokenHash } = createRefreshToken();
  assert.ok(Buffer.from(token, 'base64url').length >= 32);
  assert.match(tokenHash, /^[0-9a-f]{64}$/);
  assert.notEqual(tokenHash, token);
  assert.equal(hashRefreshToken(token), tokenHash);
});

test('SO-17: 같은 입력은 같은 해시이고 node:crypto sha256 hex와 같다', () => {
  assert.equal(hashRefreshToken('abc'), hashRefreshToken('abc'));
  assert.equal(hashRefreshToken('abc'), crypto.createHash('sha256').update('abc').digest('hex'));
});

test('SO-17: 리프레시 토큰은 생성할 때마다 다르다', () => {
  const a = createRefreshToken();
  const b = createRefreshToken();
  assert.notEqual(a.token, b.token);
  assert.notEqual(a.tokenHash, b.tokenHash);
});

test('NFR-07: issueSessionTokens는 서로 연결된 세션 토큰 묶음을 돌려준다', () => {
  const now = 1_700_000_000_000;
  const s = issueSessionTokens(USER_ID, now);
  assert.deepEqual(Object.keys(s).sort(), [
    'accessToken',
    'csrfToken',
    'jti',
    'refreshExpiresAt',
    'refreshToken',
    'refreshTokenHash',
  ]);
  assert.equal(s.refreshExpiresAt, new Date(now + 604800000).toISOString());
  assert.deepEqual(verifyAccessToken(s.accessToken), { sub: USER_ID, jti: s.jti });
  assert.equal(hashRefreshToken(s.refreshToken), s.refreshTokenHash);
  assert.equal(verifyCsrfToken({ cookie: s.csrfToken, header: s.csrfToken, jti: s.jti }), true);
});

test('NFR-15: 정상 CSRF 토큰은 통과한다', () => {
  const t = createCsrfToken('jti-1');
  assert.equal(verifyCsrfToken({ cookie: t, header: t, jti: 'jti-1' }), true);
});

test('NFR-15: 서명이 변조된 CSRF 토큰은 실패한다', () => {
  const [nonce, sig] = createCsrfToken('jti-1').split('.');
  const bad = `${nonce}.${tamper(sig)}`;
  assert.equal(verifyCsrfToken({ cookie: bad, header: bad, jti: 'jti-1' }), false);
});

test('NFR-15: 다른 JWT 식별자로 만든 CSRF 토큰은 실패한다', () => {
  const t = createCsrfToken('jti-other');
  assert.equal(verifyCsrfToken({ cookie: t, header: t, jti: 'jti-1' }), false);
});

test('NFR-15: 쿠키와 헤더가 다르면 실패한다', () => {
  const a = createCsrfToken('jti-1');
  const b = createCsrfToken('jti-1');
  assert.equal(verifyCsrfToken({ cookie: a, header: b, jti: 'jti-1' }), false);
});

test('NFR-15: 헤더가 없으면 실패한다', () => {
  const t = createCsrfToken('jti-1');
  assert.equal(verifyCsrfToken({ cookie: t, header: undefined, jti: 'jti-1' }), false);
});

test('NFR-15: 점으로 정확히 두 조각이 아니면 실패한다', () => {
  for (const v of ['noDotValue', 'a.b.c']) {
    assert.equal(verifyCsrfToken({ cookie: v, header: v, jti: 'jti-1' }), false);
  }
});

test('NFR-15: 서명 길이가 다르면 실패한다', () => {
  const [nonce, sig] = createCsrfToken('jti-1').split('.');
  for (const v of [`${nonce}.${sig}AA`, `${nonce}.${sig.slice(0, -4)}`]) {
    assert.equal(verifyCsrfToken({ cookie: v, header: v, jti: 'jti-1' }), false);
  }
});
