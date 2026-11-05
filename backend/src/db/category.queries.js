// DL-07: 모든 SELECT·UPDATE·DELETE에 user_id = $n
const CATEGORY_COLUMNS = `id, user_id AS "userId", name, is_default AS "isDefault", created_at AS "createdAt"`;

// 9-design.md D-06 정렬, D-11 todoCount
export async function listByUser(db, userId) {
  const { rows } = await db.query(
    `SELECT ${CATEGORY_COLUMNS},
       (SELECT count(*)::int FROM todos t
         WHERE t.user_id = categories.user_id AND t.category_id = categories.id) AS "todoCount"
     FROM categories
     WHERE user_id = $1
     ORDER BY is_default DESC, created_at, id`,
    [userId],
  );
  return rows;
}

export async function findById(db, userId, id) {
  const { rows } = await db.query(
    `SELECT ${CATEGORY_COLUMNS} FROM categories WHERE user_id = $1 AND id = $2`,
    [userId, id],
  );
  return rows[0] ?? null;
}

export async function findDefault(db, userId) {
  const { rows } = await db.query(
    `SELECT ${CATEGORY_COLUMNS} FROM categories WHERE user_id = $1 AND is_default`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function insert(db, { userId, name, isDefault = false }) {
  const { rows } = await db.query(
    `INSERT INTO categories (user_id, name, is_default) VALUES ($1, $2, $3) RETURNING ${CATEGORY_COLUMNS}`,
    [userId, name, isDefault],
  );
  return rows[0];
}

export async function update(db, userId, id, name) {
  const { rows } = await db.query(
    `UPDATE categories SET name = $3 WHERE user_id = $1 AND id = $2 RETURNING ${CATEGORY_COLUMNS}`,
    [userId, id, name],
  );
  return rows[0] ?? null;
}

export async function remove(db, userId, id) {
  const { rowCount } = await db.query('DELETE FROM categories WHERE user_id = $1 AND id = $2', [
    userId,
    id,
  ]);
  return rowCount > 0;
}

// DL-08, AQ-08: 삭제 트랜잭션 시작 때 대상 행을 잠근다
export async function lockForUpdate(db, userId, id) {
  const { rows } = await db.query(
    `SELECT ${CATEGORY_COLUMNS} FROM categories WHERE user_id = $1 AND id = $2 FOR UPDATE`,
    [userId, id],
  );
  return rows[0] ?? null;
}

// SO-11: 시드 재실행용. 그 사용자의 할일을 먼저 지워야 한다(FK RESTRICT)
export async function removeAllForUser(db, userId) {
  const { rowCount } = await db.query('DELETE FROM categories WHERE user_id = $1', [userId]);
  return rowCount;
}
