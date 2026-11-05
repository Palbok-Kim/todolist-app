const USER_COLUMNS = `id, email, password_hash AS "passwordHash", name, timezone,
  created_at AS "createdAt", updated_at AS "updatedAt"`;

// DL-07 예외: 로그인 조회는 email로 찾는다
export async function findByEmail(db, email) {
  const { rows } = await db.query(`SELECT ${USER_COLUMNS} FROM users WHERE email = $1`, [email]);
  return rows[0] ?? null;
}

export async function findById(db, id) {
  const { rows } = await db.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function insert(db, { email, passwordHash, name, timezone }) {
  const { rows } = await db.query(
    `INSERT INTO users (email, password_hash, name, timezone) VALUES ($1, $2, $3, $4)
     RETURNING ${USER_COLUMNS}`,
    [email, passwordHash, name, timezone],
  );
  return rows[0];
}

// EQ-02: updated_at은 앱이 갱신한다
export async function updateTimezone(db, id, timezone) {
  const { rows } = await db.query(
    `UPDATE users SET timezone = $2, updated_at = now() WHERE id = $1 RETURNING ${USER_COLUMNS}`,
    [id, timezone],
  );
  return rows[0] ?? null;
}

export async function updateName(db, id, name) {
  const { rows } = await db.query(
    `UPDATE users SET name = $2, updated_at = now() WHERE id = $1 RETURNING ${USER_COLUMNS}`,
    [id, name],
  );
  return rows[0] ?? null;
}

export async function updatePasswordHash(db, id, passwordHash) {
  const { rows } = await db.query(
    `UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1 RETURNING ${USER_COLUMNS}`,
    [id, passwordHash],
  );
  return rows[0] ?? null;
}

// SO-11: 시드 재실행 때 시드 도메인 계정만 찾는다
export async function listIdsByEmailDomain(db, domain) {
  const { rows } = await db.query("SELECT id FROM users WHERE email LIKE '%@' || $1", [domain]);
  return rows.map((r) => r.id);
}

export async function remove(db, id) {
  const { rowCount } = await db.query('DELETE FROM users WHERE id = $1', [id]);
  return rowCount > 0;
}
