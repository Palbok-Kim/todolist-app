import { randomUUID } from 'node:crypto';
import { AppError, ERR } from '../errors.js';
import { config } from '../config.js';
import { hashPassword, needsRehash, verifyDummy, verifyPassword } from '../lib/password.js';
import { issueSessionTokens, hashRefreshToken } from '../lib/token.js';
import { isLimited, recordFailure } from '../lib/loginAttempts.js';
import { logger } from '../lib/logger.js';
import { validateLogin, validateSignup } from '../validation/user.validation.js';
import * as categoryQueries from '../db/category.queries.js';
import { pool, withTransaction } from '../db/pool.js';
import * as refreshTokenQueries from '../db/refreshToken.queries.js';
import * as userQueries from '../db/user.queries.js';

// passwordHash는 응답에 싣지 않는다
function toUser({ id, email, name, timezone, createdAt, updatedAt }) {
  return { id, email, name, timezone, createdAt, updatedAt };
}

// BR-03, AQ-12: 사용자·기본 카테고리·refresh 토큰을 한 트랜잭션으로 만든다
export async function signup(body) {
  const { value, fields } = validateSignup(body);
  if (fields.length) throw new AppError(ERR.VALIDATION_ERROR, '입력값을 확인해 주세요.', fields);

  // 느린 scrypt는 트랜잭션(연결 점유) 밖에서 계산한다
  const passwordHash = await hashPassword(value.password);
  const familyId = randomUUID();

  try {
    return await withTransaction(async (db) => {
      const user = toUser(
        await userQueries.insert(db, {
          email: value.email,
          passwordHash,
          name: value.name,
          timezone: value.timezone,
        }),
      );
      // user.id가 필요해 안에서 호출하지만 I/O 없는 동기 함수라 연결을 오래 잡지 않는다
      const tokens = issueSessionTokens(user.id);
      await categoryQueries.insert(db, { userId: user.id, name: '기본', isDefault: true });
      await refreshTokenQueries.insert(db, {
        userId: user.id,
        familyId,
        tokenHash: tokens.refreshTokenHash,
        expiresAt: tokens.refreshExpiresAt,
      });
      return { user, tokens };
    });
  } catch (err) {
    // VR-01, SO-07: 중복 검사는 선조회가 아니라 UNIQUE 위반으로 판정한다
    if (err.code === '23505' && err.constraint === 'uq_users_email') {
      const message = '이미 사용 중인 이메일입니다.';
      throw new AppError(ERR.CONFLICT, message, [{ field: 'email', message }]);
    }
    throw err;
  }
}

// AC-14: 이메일 없음과 비밀번호 불일치를 같은 응답으로 숨긴다
export async function login(body, ip) {
  const { value, fields } = validateLogin(body);
  // AQ-04: 형식 오류는 실패로 집계하지 않는다
  if (fields.length) throw new AppError(ERR.VALIDATION_ERROR, '입력값을 확인해 주세요.', fields);

  const key = { ip, email: value.email };
  // NFR-10: 제한 중에는 비밀번호를 검증하지 않고 집계도 하지 않는다
  if (isLimited(key)) {
    throw new AppError(
      ERR.TOO_MANY_REQUESTS,
      '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    );
  }

  const row = await userQueries.findByEmail(pool, value.email);
  // 계정이 없어도 scrypt를 한 번 수행해 응답 시간 차이로 존재 여부가 드러나지 않게 한다
  const ok = row
    ? await verifyPassword(value.password, row.passwordHash)
    : await verifyDummy(value.password);
  if (!ok) {
    recordFailure(key);
    throw new AppError(ERR.INVALID_CREDENTIALS, '이메일 또는 비밀번호가 올바르지 않습니다.');
  }

  // 9-design 3장: 재해시 실패는 로그인 성공을 막지 않는다
  if (needsRehash(row.passwordHash)) {
    try {
      await userQueries.updatePasswordHash(pool, row.id, await hashPassword(value.password));
    } catch (err) {
      logger.error({ message: '비밀번호 재해시 실패', userId: row.id, error: err.message });
    }
  }

  // 느린 연산은 트랜잭션 밖에서 끝내고 DB 쓰기만 묶는다(AQ-12)
  const tokens = issueSessionTokens(row.id);
  const familyId = randomUUID();
  await withTransaction(async (db) => {
    // OI-21: 로그인 때 만료된 행을 정리한다
    await refreshTokenQueries.deleteExpiredForUser(db, row.id);
    await refreshTokenQueries.insert(db, {
      userId: row.id,
      familyId,
      tokenHash: tokens.refreshTokenHash,
      expiresAt: tokens.refreshExpiresAt,
    });
  });
  return { user: toUser(row), tokens };
}

export async function logout(refreshToken) {
  if (!refreshToken) return;
  try {
    // 토큰 해시가 자격 증명이라 userId 조건이 없다(DL-07 예외). 트랜잭션 밖 FOR UPDATE는 자동 커밋된다
    const row = await refreshTokenQueries.findByHashForUpdate(pool, hashRefreshToken(refreshToken));
    if (row) await refreshTokenQueries.revokeFamily(pool, row.familyId);
  } catch (err) {
    // BR-01: 폐기에 실패해도 로그아웃은 성공시킨다
    logger.error({ message: '로그아웃 토큰 폐기 실패', error: err.message });
  }
}

// AD-14 결과 코드. 재사용의 계열 폐기는 커밋돼야 해서 트랜잭션 안에서 던지지 않는다(AQ-11)
const REFRESH_RESULT = Object.freeze({
  OK: 'ok',
  UNKNOWN: 'unknown',
  EXPIRED: 'expired',
  GRACE: 'grace',
  REUSED: 'reused',
});

// BR-16, NFR-07: 회전(이전 행 폐기 + 같은 계열 새 행, 7일 슬라이딩)과 재사용 감지
export async function refresh(refreshToken) {
  const denied = () => new AppError(ERR.UNAUTHORIZED, '로그인이 필요합니다.');
  if (!refreshToken) throw denied();
  const tokenHash = hashRefreshToken(refreshToken);

  const outcome = await withTransaction(async (db) => {
    // DL-08: 같은 토큰의 동시 갱신은 이 행 잠금에서 직렬화된다
    const row = await refreshTokenQueries.findByHashForUpdate(db, tokenHash);
    if (!row) return { result: REFRESH_RESULT.UNKNOWN };
    const now = Date.now(); // 잠금을 얻은 뒤의 시각이라 동시 갱신의 패자는 유예 안에 든다
    if (row.revokedAt) {
      // OI-20, AQ-13: 유예 안이면 계열을 두고 거부만 한다
      if (now - row.revokedAt.getTime() <= config.refreshReuseGraceMs)
        return { result: REFRESH_RESULT.GRACE };
      await refreshTokenQueries.revokeFamily(db, row.familyId);
      return { result: REFRESH_RESULT.REUSED, userId: row.userId };
    }
    if (row.expiresAt.getTime() <= now) return { result: REFRESH_RESULT.EXPIRED };
    // I/O 없는 동기 함수라 연결을 오래 잡지 않는다
    const tokens = issueSessionTokens(row.userId, now);
    await refreshTokenQueries.revokeById(db, row.id);
    await refreshTokenQueries.insert(db, {
      userId: row.userId,
      familyId: row.familyId,
      tokenHash: tokens.refreshTokenHash,
      expiresAt: tokens.refreshExpiresAt,
    });
    return { result: REFRESH_RESULT.OK, tokens };
  });

  if (outcome.result === REFRESH_RESULT.REUSED)
    logger.error({ message: '리프레시 토큰 재사용 감지, 계열 폐기', userId: outcome.userId });
  if (outcome.result !== REFRESH_RESULT.OK) throw denied();
  return outcome.tokens;
}
