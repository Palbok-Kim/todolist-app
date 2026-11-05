// NFR-15, 9-design.md 5.4: jti에 묶은 HMAC 서명 토큰 `<nonce>.<sig>`
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

function sign(jti, nonce) {
  return createHmac('sha256', config.csrfSecret).update(`${jti}.${nonce}`).digest('base64url');
}

export function createCsrfToken(jti) {
  const nonce = randomBytes(16).toString('base64url');
  return `${nonce}.${sign(jti, nonce)}`;
}

export function verifyCsrfToken({ cookie, header, jti }) {
  if (typeof cookie !== 'string' || typeof header !== 'string' || typeof jti !== 'string')
    return false;
  if (cookie !== header) return false;
  const parts = cookie.split('.');
  if (parts.length !== 2) return false;
  const expected = Buffer.from(sign(jti, parts[0]));
  const actual = Buffer.from(parts[1]);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
