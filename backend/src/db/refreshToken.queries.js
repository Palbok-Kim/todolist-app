// SO-17: 토큰 원문은 다루지 않고 SHA-256 해시만 주고받는다. 판단(만료·유예)은 service가 한다
const REFRESH_COLUMNS = `id, user_id AS "userId", family_id AS "familyId", token_hash AS "tokenHash",
  expires_at AS "expiresAt", revoked_at AS "revokedAt", created_at AS "createdAt"`;

export async function insert(db, { userId, familyId, tokenHash, expiresAt }) {
  const { rows } = await db.query(
    `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)
     RETURNING ${REFRESH_COLUMNS}`,
    [userId, familyId, tokenHash, expiresAt],
  );
  return rows[0];
}

// DL-08: 같은 토큰의 동시 갱신을 행 잠금으로 직렬화한다 (트랜잭션 client로 호출)
export async function findByHashForUpdate(db, tokenHash) {
  const { rows } = await db.query(
    `SELECT ${REFRESH_COLUMNS} FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE`,
    [tokenHash],
  );
  return rows[0] ?? null;
}

export async function revokeById(db, id) {
  const { rowCount } = await db.query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL',
    [id],
  );
  return rowCount;
}

// EQ-10: 미폐기 행만 바꿔 회전 때 기록한 revoked_at을 유지한다
export async function revokeFamily(db, familyId) {
  const { rowCount } = await db.query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL',
    [familyId],
  );
  return rowCount;
}

// PRD 4.4: 비밀번호 변경
export async function revokeAllForUser(db, userId) {
  const { rowCount } = await db.query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
    [userId],
  );
  return rowCount;
}

// OI-21, EQ-11: 만료된 행만 지운다. 만료 전에 폐기된 행은 재사용 감지에 필요해 남긴다
// LIMIT: 로그인하지 않는 사용자의 만료 행은 남는다, 행이 문제 될 만큼 쌓이면 주기 정리를 추가한다
export async function deleteExpiredForUser(db, userId) {
  const { rowCount } = await db.query(
    'DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at <= now()',
    [userId],
  );
  return rowCount;
}

// SO-11: 시드 재실행 때 사용자 삭제 전에 지운다(FK RESTRICT)
export async function deleteAllForUser(db, userId) {
  const { rowCount } = await db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
  return rowCount;
}
