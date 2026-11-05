import { randomUUID } from 'node:crypto';
import { AppError, ERR } from '../errors.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { issueSessionTokens } from '../lib/token.js';
import { validatePasswordChange, validateUserUpdate } from '../validation/user.validation.js';
import { pool, withTransaction } from '../db/pool.js';
import * as refreshTokenQueries from '../db/refreshToken.queries.js';
import * as userQueries from '../db/user.queries.js';

// passwordHash는 응답에 싣지 않는다(서비스끼리 import 금지라 auth.service와 따로 둔다, DL-01)
function toUser({ id, email, name, timezone, createdAt, updatedAt }) {
  return { id, email, name, timezone, createdAt, updatedAt };
}

// 토큰은 유효한데 계정이 없으면 로그인을 다시 하게 한다
const gone = () => new AppError(ERR.UNAUTHORIZED, '로그인이 필요합니다.');
const invalid = (fields) => new AppError(ERR.VALIDATION_ERROR, '입력값을 확인해 주세요.', fields);

// AQ-03, DL-06: 시간대는 토큰이 아니라 DB에서 읽는다
export async function getMe(userId) {
  const user = await userQueries.findById(pool, userId);
  if (!user) throw gone();
  return toUser(user);
}

// FR-03, OI-03: timezone(P0)·name(P1)만 바꾼다. email은 바꿀 수 없다
export async function updateMe(userId, body) {
  const { value, fields } = validateUserUpdate(body);
  if (fields.length) throw invalid(fields);
  if (Object.keys(value).length === 0)
    throw new AppError(ERR.VALIDATION_ERROR, '변경할 항목이 없습니다.');
  const user = await withTransaction(async (db) => {
    let row = null;
    if (value.timezone) row = await userQueries.updateTimezone(db, userId, value.timezone);
    if (value.name) row = await userQueries.updateName(db, userId, value.name);
    return row;
  });
  if (!user) throw gone();
  return toUser(user);
}

// PRD 4.4: 성공하면 모든 리프레시 토큰을 폐기하고 현재 기기에는 새 계열 세션을 준다(AC-20, BR-16)
export async function changePassword(userId, body) {
  const { value, fields } = validatePasswordChange(body);
  if (fields.length) throw invalid(fields);
  const user = await userQueries.findById(pool, userId);
  if (!user) throw gone();
  // AC-21: 로그인 실패 횟수(NFR-10)에 넣지 않는다
  if (!(await verifyPassword(value.currentPassword, user.passwordHash)))
    throw invalid([{ field: 'currentPassword', message: '현재 비밀번호가 올바르지 않습니다.' }]);

  // 느린 scrypt와 토큰 생성은 트랜잭션 밖에서 끝낸다(DL-08)
  const passwordHash = await hashPassword(value.newPassword);
  const tokens = issueSessionTokens(userId);
  await withTransaction(async (db) => {
    await userQueries.updatePasswordHash(db, userId, passwordHash);
    await refreshTokenQueries.revokeAllForUser(db, userId);
    await refreshTokenQueries.insert(db, {
      userId,
      familyId: randomUUID(),
      tokenHash: tokens.refreshTokenHash,
      expiresAt: tokens.refreshExpiresAt,
    });
  });
  return tokens;
}
