import { statusCase } from './todoStatus.js';

// DL-07: 모든 문에 user_id = $1. today는 항상 $2로 바인딩한다(DL-09)
const TODO_COLUMNS = `id, user_id AS "userId", category_id AS "categoryId", title, description,
  start_date AS "startDate", end_date AS "endDate", completed, completed_at AS "completedAt",
  created_at AS "createdAt", updated_at AS "updatedAt", ${statusCase('$2')} AS status`;

// BR-11 고정 정렬 (DL-10: 요청 값으로 바꾸지 않는다)
const ORDER_BY = 'ORDER BY end_date, start_date, created_at, id';

// update에서 바꿀 수 있는 필드 → 컬럼 허용 목록 (DL-10)
const UPDATABLE = Object.freeze({
  categoryId: 'category_id',
  title: 'title',
  description: 'description',
  startDate: 'start_date',
  endDate: 'end_date',
});

export async function insert(db, userId, today, todo) {
  const { rows } = await db.query(
    `INSERT INTO todos (user_id, category_id, title, description, start_date, end_date)
     VALUES ($1, $3, $4, $5, $6, $7)
     RETURNING ${TODO_COLUMNS}`,
    [userId, today, todo.categoryId, todo.title, todo.description, todo.startDate, todo.endDate],
  );
  return rows[0];
}

export async function findById(db, userId, today, id) {
  const { rows } = await db.query(
    `SELECT ${TODO_COLUMNS} FROM todos WHERE user_id = $1 AND id = $3`,
    [userId, today, id],
  );
  return rows[0] ?? null;
}

// patch의 undefined 필드는 유지한다. completed는 completed_at과 함께 바꾼다(BR-13)
export async function update(db, userId, today, id, patch) {
  const values = [userId, today, id];
  const sets = ['updated_at = now()'];
  for (const [field, column] of Object.entries(UPDATABLE)) {
    if (patch[field] === undefined) continue;
    values.push(patch[field]);
    sets.push(`${column} = $${values.length}`);
  }
  if (patch.completed !== undefined) {
    values.push(patch.completed);
    const p = `$${values.length}::boolean`;
    sets.push(
      `completed = ${p}`,
      `completed_at = CASE WHEN ${p} THEN COALESCE(completed_at, now()) END`,
    );
  }
  const { rows } = await db.query(
    `UPDATE todos SET ${sets.join(', ')} WHERE user_id = $1 AND id = $3 RETURNING ${TODO_COLUMNS}`,
    values,
  );
  return rows[0] ?? null;
}

export async function remove(db, userId, id) {
  const { rowCount } = await db.query('DELETE FROM todos WHERE user_id = $1 AND id = $2', [
    userId,
    id,
  ]);
  return rowCount > 0;
}

// FR-05: 카테고리·상태 필터는 AND. 둘 다 선택이다(null이면 조건 없음)
export async function listByUser(db, userId, today, { categoryId = null, status = null } = {}) {
  const { rows } = await db.query(
    `SELECT ${TODO_COLUMNS} FROM todos
     WHERE user_id = $1
       AND ($3::uuid IS NULL OR category_id = $3)
       AND ($4::text IS NULL OR ${statusCase('$2')} = $4)
     ${ORDER_BY}`,
    [userId, today, categoryId, status],
  );
  return rows;
}

// AQ-07, BR-12: 기간이 [from, to]와 겹치는 할일
export async function listByRange(db, userId, today, from, to) {
  const { rows } = await db.query(
    `SELECT ${TODO_COLUMNS} FROM todos
     WHERE user_id = $1 AND end_date >= $3 AND start_date <= $4
     ${ORDER_BY}`,
    [userId, today, from, to],
  );
  return rows;
}

// BR-06: 카테고리 삭제 전에 할일을 다른 카테고리(기본)로 옮긴다. 옮긴 건수를 돌려준다
export async function moveToCategory(db, userId, fromCategoryId, toCategoryId) {
  const { rowCount } = await db.query(
    `UPDATE todos SET category_id = $3, updated_at = now()
     WHERE user_id = $1 AND category_id = $2`,
    [userId, fromCategoryId, toCategoryId],
  );
  return rowCount;
}

// SO-11: 시드 재실행용
export async function removeAllForUser(db, userId) {
  const { rowCount } = await db.query('DELETE FROM todos WHERE user_id = $1', [userId]);
  return rowCount;
}

// 시드 전용 일괄 등록. 날짜는 오늘 기준 상대 일수(startOffset, endOffset)로 받는다(DB-08)
// shortcut: 오늘을 DB 세션 시간대의 CURRENT_DATE로 잡는다, 사용자 시간대 오늘이 필요해지면 getToday 값을 바인딩한다
export async function insertManyRelative(db, userId, rows) {
  const { rowCount } = await db.query(
    `INSERT INTO todos (user_id, category_id, title, start_date, end_date, completed, completed_at)
     SELECT $1, t.category_id, t.title, CURRENT_DATE + t.start_offset, CURRENT_DATE + t.end_offset,
            t.completed, CASE WHEN t.completed THEN now() END
     FROM unnest($2::uuid[], $3::text[], $4::int[], $5::int[], $6::boolean[])
       AS t(category_id, title, start_offset, end_offset, completed)`,
    [
      userId,
      rows.map((r) => r.categoryId),
      rows.map((r) => r.title),
      rows.map((r) => r.startOffset),
      rows.map((r) => r.endOffset),
      rows.map((r) => r.completed),
    ],
  );
  return rowCount;
}
