// NFR-06, 9-design.md 3장: 비동기 scrypt, 저장 포맷 scrypt$N$r$p$salt$hash (base64url)
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);

// 조정 가능 (QA-06 login 결과로 확인). 바꾸면 로그인 때 needsRehash로 재해시된다
const PARAMS = Object.freeze({ N: 2 ** 15, r: 8, p: 3 });
const KEYLEN = 64;
const SALT_BYTES = 16;
const MAXMEM = 64 * 1024 * 1024;

async function derive(password, salt, { N, r, p }) {
  return scrypt(password, salt, KEYLEN, { N, r, p, maxmem: MAXMEM });
}

function parse(stored) {
  const [alg, N, r, p, salt, hash] = stored.split('$');
  if (alg !== 'scrypt' || !hash) throw new Error('알 수 없는 비밀번호 해시 형식');
  return {
    params: { N: Number(N), r: Number(r), p: Number(p) },
    salt: Buffer.from(salt, 'base64url'),
    hash: Buffer.from(hash, 'base64url'),
  };
}

// PRD 4.1: 입력값 그대로 해시한다(공백 제거 없음)
export async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES);
  const hash = await derive(password, salt, PARAMS);
  const { N, r, p } = PARAMS;
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(password, stored) {
  const { params, salt, hash } = parse(stored);
  const actual = await derive(password, salt, params);
  return actual.length === hash.length && timingSafeEqual(actual, hash);
}

export function needsRehash(stored) {
  const { params } = parse(stored);
  return params.N !== PARAMS.N || params.r !== PARAMS.r || params.p !== PARAMS.p;
}

// ERR-03: 없는 email도 scrypt 1회를 거쳐 응답 시간을 맞춘다. 결과는 항상 false
const dummyHash = hashPassword('dummy-password-for-timing');
export async function verifyDummy(password) {
  await verifyPassword(password, await dummyHash);
  return false;
}
