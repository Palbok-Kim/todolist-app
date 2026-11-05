import { AppError, ERR } from '../errors.js';
import { isUuid } from '../validation/common.js';
import { validateCategory } from '../validation/category.validation.js';
import { pool, withTransaction } from '../db/pool.js';
import * as categoryQueries from '../db/category.queries.js';
import * as todoQueries from '../db/todo.queries.js';

// userId는 응답에 싣지 않는다(swagger Category)
const toCategory = ({ id, name, isDefault, createdAt }) => ({ id, name, isDefault, createdAt });
// BR-02, SO-07: 없는·남의 카테고리와 uuid 형식 오류를 구분하지 않는다
const notFound = () => new AppError(ERR.NOT_FOUND, '대상을 찾을 수 없습니다.');
// BR-05, AC-03
const defaultLocked = () =>
  new AppError(ERR.VALIDATION_ERROR, '기본 카테고리는 바꾸거나 삭제할 수 없습니다.');

function validated(body) {
  const { value, fields } = validateCategory(body);
  if (fields.length) throw new AppError(ERR.VALIDATION_ERROR, '입력값을 확인해 주세요.', fields);
  return value;
}

// BR-14, D-10: 중복('기본' 포함, 공백 제거·대소문자 무시)은 선조회가 아니라 UNIQUE 위반으로 판정한다
function translateConflict(err) {
  if (err.code === '23505' && err.constraint === 'uq_categories_user_id_lower_name') {
    const message = '이미 있는 카테고리 이름입니다.';
    return new AppError(ERR.CONFLICT, message, [{ field: 'name', message }]);
  }
  return err;
}

// D-11: todoCount는 조회 시점의 안내 값
export async function listCategories(userId) {
  const rows = await categoryQueries.listByUser(pool, userId);
  return rows.map((row) => ({ ...toCategory(row), todoCount: row.todoCount }));
}

export async function createCategory(userId, body) {
  const { name } = validated(body);
  try {
    return toCategory(await categoryQueries.insert(pool, { userId, name }));
  } catch (err) {
    throw translateConflict(err);
  }
}

// AD-10 순서: 존재·소유 → 기본 카테고리 여부
export async function renameCategory(userId, id, body) {
  const { name } = validated(body);
  if (!isUuid(id)) throw notFound();
  const category = await categoryQueries.findById(pool, userId, id);
  if (!category) throw notFound();
  if (category.isDefault) throw defaultLocked();
  try {
    const updated = await categoryQueries.update(pool, userId, id, name);
    if (!updated) throw notFound();
    return toCategory(updated);
  } catch (err) {
    throw translateConflict(err);
  }
}

// BR-06, DL-08, AQ-08: 대상 행을 잠그고 할일을 기본 카테고리로 옮긴 뒤 한 트랜잭션에서 삭제한다
export async function deleteCategory(userId, id) {
  if (!isUuid(id)) throw notFound();
  try {
    await withTransaction(async (db) => {
      const category = await categoryQueries.lockForUpdate(db, userId, id);
      if (!category) throw notFound();
      if (category.isDefault) throw defaultLocked();
      const fallback = await categoryQueries.findDefault(db, userId);
      await todoQueries.moveToCategory(db, userId, id, fallback.id);
      await categoryQueries.remove(db, userId, id);
    });
  } catch (err) {
    // SO-07: 잠금 전에 들어온 할일 등으로 FK(RESTRICT)가 막으면 ERR-07이 아니라 ERR-05
    if (err.code === '23503') throw notFound();
    throw err;
  }
}
