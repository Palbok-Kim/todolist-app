import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, needsRehash, verifyDummy } from '../../src/lib/password.js';

test('NFR-06: 같은 비밀번호도 salt가 달라 해시가 다르고 둘 다 검증된다', async () => {
  const pw = 'correct horse battery';
  const [h1, h2] = await Promise.all([hashPassword(pw), hashPassword(pw)]);
  assert.notEqual(h1, h2);
  assert.equal(await verifyPassword(pw, h1), true);
  assert.equal(await verifyPassword(pw, h2), true);
  assert.equal(await verifyPassword('wrong password!!', h1), false);
});

test('NFR-06: 73자 이상 비밀번호의 끝 글자만 다르면 실패한다', async () => {
  const pw = 'a'.repeat(100);
  const h = await hashPassword(pw);
  assert.equal(await verifyPassword('a'.repeat(99) + 'b', h), false);
});

test('NFR-06: 앞뒤 공백이 있는 비밀번호는 공백을 뺀 값으로 검증되지 않는다', async () => {
  const h = await hashPassword('  spaced password  ');
  assert.equal(await verifyPassword('spaced password', h), false);
  assert.equal(await verifyPassword('  spaced password  ', h), true);
});

test('NFR-06: 저장 문자열에 알고리즘·파라미터·salt가 파싱 가능하게 있다', async () => {
  const h = await hashPassword('correct horse battery');
  const [alg, N, r, p, salt, hash] = h.split('$');
  assert.deepEqual([alg, N, r, p], ['scrypt', '32768', '8', '3']);
  assert.equal(Buffer.from(salt, 'base64url').length, 16);
  assert.equal(Buffer.from(hash, 'base64url').length, 64);
  assert.equal(needsRehash(h), false);
  assert.equal(needsRehash(h.replace('$32768$', '$16384$')), true);
});

test('ERR-03: 더미 검증은 항상 false다', async () => {
  assert.equal(await verifyDummy('anything at all'), false);
});
