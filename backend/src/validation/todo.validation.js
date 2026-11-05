import { asObject, checkDate, checkDateOrder, checkText, isUuid } from './common.js';

// VR-05
const TITLE_MAX = 100;
// VR-06
const DESCRIPTION_MAX = 1000;

export function validateTodoCreate(body) {
  const b = asObject(body);
  const fields = [];
  const value = {};
  const run = (field, r) => {
    if (r.error) fields.push({ field, message: r.error });
    else value[field] = r.value;
    return r;
  };
  run('title', checkText(b.title, { max: TITLE_MAX }));
  run('description', checkText(b.description, { max: DESCRIPTION_MAX, required: false }));
  const s = run('startDate', checkDate(b.startDate));
  const e = run('endDate', checkDate(b.endDate));
  if (!s.error && !e.error) {
    const msg = checkDateOrder(s.value, e.value);
    if (msg) fields.push({ field: 'endDate', message: msg });
  }
  if (b.categoryId === undefined || b.categoryId === null) value.categoryId = null;
  else if (isUuid(b.categoryId)) value.categoryId = b.categoryId;
  else fields.push({ field: 'categoryId', message: '카테고리를 찾을 수 없습니다.' });
  return { value, fields };
}

// 보낸 필드만 검사해 value에 담는다. 날짜 순서(BR-07)는 기존 값과 합친 뒤 service가 본다
export function validateTodoUpdate(body) {
  const b = asObject(body);
  const fields = [];
  const value = {};
  const run = (field, check) => {
    if (b[field] === undefined) return;
    const r = check(b[field]);
    if (r.error) fields.push({ field, message: r.error });
    else value[field] = r.value;
  };
  run('title', (v) => checkText(v, { max: TITLE_MAX }));
  run('description', (v) => checkText(v, { max: DESCRIPTION_MAX, required: false }));
  run('startDate', checkDate);
  run('endDate', checkDate);
  // D-05: categoryId null은 허용하지 않는다
  run('categoryId', (v) => (isUuid(v) ? { value: v } : { error: '카테고리를 찾을 수 없습니다.' }));
  run('completed', (v) =>
    typeof v === 'boolean' ? { value: v } : { error: '완료 여부를 확인해 주세요.' },
  );
  return { value, fields };
}

// AQ-07: 캘린더 기간은 양 끝 포함 42일 이하(월간 그리드 6주)
const RANGE_MAX_DAYS = 42;
const dayNumber = (date) => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

export function validateCalendarRange(query) {
  const q = asObject(query);
  const fields = [];
  const from = checkDate(q.from);
  const to = checkDate(q.to);
  if (from.error) fields.push({ field: 'from', message: from.error });
  if (to.error) fields.push({ field: 'to', message: to.error });
  if (!fields.length) {
    const order = checkDateOrder(from.value, to.value);
    if (order) fields.push({ field: 'to', message: order });
    else if (dayNumber(to.value) - dayNumber(from.value) + 1 > RANGE_MAX_DAYS)
      fields.push({ field: 'to', message: `기간은 ${RANGE_MAX_DAYS}일 이하여야 합니다.` });
  }
  return { value: { from: from.value, to: to.value }, fields };
}
