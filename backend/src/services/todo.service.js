import { AppError, ERR } from '../errors.js';
import { getToday } from '../lib/today.js';
import { checkDateOrder, isUuid } from '../validation/common.js';
import {
  validateCalendarRange,
  validateTodoCreate,
  validateTodoUpdate,
} from '../validation/todo.validation.js';
import { pool } from '../db/pool.js';
import * as categoryQueries from '../db/category.queries.js';
import * as todoQueries from '../db/todo.queries.js';
import * as userQueries from '../db/user.queries.js';
import { TODO_STATUS } from '../db/todoStatus.js';

// BR-02, SO-07: 없는·남의 리소스와 uuid 형식 오류를 구분하지 않는다
const notFound = () => new AppError(ERR.NOT_FOUND, '대상을 찾을 수 없습니다.');

// userId는 응답에 싣지 않는다(swagger Todo)
function toTodo(row) {
  const todo = { ...row };
  delete todo.userId;
  return todo;
}

// SO-07: 확인 뒤 카테고리가 동시에 삭제되면 FK(RESTRICT) 위반이 난다. 500이 아니라 404로 돌려준다
async function guardFk(promise) {
  try {
    return await promise;
  } catch (err) {
    if (err.code === '23503') throw notFound();
    throw err;
  }
}

// 형식이 틀린 ID는 DB에 묻지 않고 없는 것으로 본다
const findCategory = (userId, id) =>
  isUuid(id) ? categoryQueries.findById(pool, userId, id) : Promise.resolve(null);

// DL-06, DL-09: 상태 판정의 오늘은 DB의 사용자 시간대로 계산한다
async function todayOf(userId) {
  const user = await userQueries.findById(pool, userId);
  if (!user) throw new AppError(ERR.UNAUTHORIZED, '로그인이 필요합니다.');
  return getToday(user.timezone);
}

export async function createTodo(userId, body) {
  const { value, fields } = validateTodoCreate(body);
  if (fields.length) throw new AppError(ERR.VALIDATION_ERROR, '입력값을 확인해 주세요.', fields);
  // BR-04: 미지정이면 기본 카테고리, BR-02: 남의·없는 카테고리는 404
  const [category, today] = await Promise.all([
    value.categoryId !== null
      ? findCategory(userId, value.categoryId)
      : categoryQueries.findDefault(pool, userId),
    todayOf(userId),
  ]);
  if (!category) throw notFound();
  return toTodo(
    await guardFk(todoQueries.insert(pool, userId, today, { ...value, categoryId: category.id })),
  );
}

export async function getTodo(userId, id) {
  if (!isUuid(id)) throw notFound();
  const todo = await todoQueries.findById(pool, userId, await todayOf(userId), id);
  if (!todo) throw notFound();
  return toTodo(todo);
}

// BR-10: 물리 삭제
export async function deleteTodo(userId, id) {
  if (!isUuid(id) || !(await todoQueries.remove(pool, userId, id))) throw notFound();
}

// BR-13: completed_at은 update 쿼리가 같은 문장에서 설정·해제한다. 상태는 서버가 다시 판정한다(PR-05)
export async function updateTodo(userId, id, body) {
  if (!isUuid(id)) throw notFound();
  const { value, fields } = validateTodoUpdate(body);
  if (fields.length) throw new AppError(ERR.VALIDATION_ERROR, '입력값을 확인해 주세요.', fields);
  if (Object.keys(value).length === 0)
    throw new AppError(ERR.VALIDATION_ERROR, '변경할 항목이 없습니다.');

  const today = await todayOf(userId);
  const current = await todoQueries.findById(pool, userId, today, id);
  if (!current) throw notFound();
  // BR-07: 수정 뒤 값으로 순서를 본다
  // shortcut: 조회와 갱신 사이 동시 수정은 DB CHECK가 막고 500이 된다, 충돌이 보이면 행 잠금 트랜잭션으로 바꾼다
  const order = checkDateOrder(
    value.startDate ?? current.startDate,
    value.endDate ?? current.endDate,
  );
  if (order)
    throw new AppError(ERR.VALIDATION_ERROR, '입력값을 확인해 주세요.', [
      { field: 'endDate', message: order },
    ]);
  if (value.categoryId !== undefined && !(await findCategory(userId, value.categoryId)))
    throw notFound();

  const updated = await guardFk(todoQueries.update(pool, userId, today, id, value));
  if (!updated) throw notFound();
  return toTodo(updated);
}

// FR-05: 카테고리·상태 필터 AND, 정렬 고정(BR-11), 페이지네이션 없음(OI-15)
export async function listTodos(userId, { categoryId, status } = {}) {
  // AD-09: 허용 목록 밖의 상태는 400
  if (status !== undefined && !Object.values(TODO_STATUS).includes(status))
    throw new AppError(ERR.VALIDATION_ERROR, '입력값을 확인해 주세요.', [
      { field: 'status', message: '상태 값이 올바르지 않습니다.' },
    ]);
  const [category, today] = await Promise.all([
    categoryId === undefined ? true : findCategory(userId, categoryId),
    todayOf(userId),
  ]);
  if (!category) throw notFound();
  const rows = await todoQueries.listByUser(pool, userId, today, {
    categoryId: categoryId ?? null,
    status: status ?? null,
  });
  return rows.map(toTodo);
}

// BR-12, AQ-07: 기간과 겹치는 할일(완료·기한 초과 포함)을 목록과 같은 정렬로 준다
export async function listCalendarTodos(userId, query) {
  const { value, fields } = validateCalendarRange(query);
  if (fields.length) throw new AppError(ERR.VALIDATION_ERROR, '입력값을 확인해 주세요.', fields);
  const today = await todayOf(userId);
  const rows = await todoQueries.listByRange(pool, userId, today, value.from, value.to);
  return rows.map(toTodo);
}
