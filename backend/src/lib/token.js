// SO-17, NFR-07: jsonwebtoken은 이 파일에서만 import한다. 알고리즘은 HS384 하나
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { toIsoTimestamp } from './today.js';

// 초 단위. 환경 변수 ACCESS_TOKEN_TTL_MINUTES·REFRESH_TOKEN_TTL_DAYS(config.js, 기본 15분·7일)에서 온다
export const ACCESS_TTL_SECONDS = config.accessTtlSeconds;
export const REFRESH_TTL_SECONDS = config.refreshTtlSeconds;

const ALGORITHM = 'HS384';

export function signAccessToken(userId) {
  const jti = randomUUID();
  const token = jwt.sign({}, config.jwtSecret, {
    algorithm: ALGORITHM,
    subject: userId,
    jwtid: jti,
    expiresIn: ACCESS_TTL_SECONDS,
  });
  return { token, jti };
}

// 어떤 실패든 null (호출자는 ERR-02로만 번역)
export function verifyAccessToken(token) {
  try {
    const { sub, jti } = jwt.verify(token, config.jwtSecret, { algorithms: [ALGORITHM] });
    return { sub, jti };
  } catch {
    return null;
  }
}

export function hashRefreshToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function createRefreshToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashRefreshToken(token) };
}

export function issueSessionTokens(userId, now = Date.now()) {
  const { token: accessToken, jti } = signAccessToken(userId);
  const { token: refreshToken, tokenHash: refreshTokenHash } = createRefreshToken();
  return {
    accessToken,
    jti,
    refreshToken,
    refreshTokenHash,
    refreshExpiresAt: toIsoTimestamp(now + REFRESH_TTL_SECONDS * 1000),
  };
}
