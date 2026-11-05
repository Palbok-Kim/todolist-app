import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTodoCreate } from '../../src/validation/todo.validation.js';
import { validateCategory } from '../../src/validation/category.validation.js';
import { isUuid, checkDate, checkDateOrder } from '../../src/validation/common.js';

const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const base = { title: '장보기', startDate: '2026-11-04', endDate: '2026-11-04' };
const fieldNames = (r) => r.fields.map((f) => f.field).sort();
const todo = (over) => validateTodoCreate({ ...base, ...over });

test('VR-05: title 0자·공백만·101자는 거부, 1자·100자는 통과한다', () => {
  for (const title of ['', '   ', 'a'.repeat(101), undefined]) {
    assert.deepEqual(fieldNames(todo({ title })), ['title']);
  }
  assert.equal(todo({ title: 'a' }).value.title, 'a');
  assert.equal(todo({ title: 'a'.repeat(100) }).value.title, 'a'.repeat(100));
  assert.equal(todo({ title: '  장보기  ' }).value.title, '장보기');
});

test('VR-06: description 공백만·누락·null은 null로 정규화된다', () => {
  for (const description of ['   ', '', undefined, null, 5]) {
    const r = todo({ description });
    assert.deepEqual(r.fields, []);
    assert.equal(r.value.description, null);
  }
});

test('VR-06: description 1000자는 통과, 1001자는 거부된다', () => {
  assert.equal(todo({ description: 'd'.repeat(1000) }).value.description, 'd'.repeat(1000));
  assert.deepEqual(fieldNames(todo({ description: 'd'.repeat(1001) })), ['description']);
});

test('BR-07: start=2026-11-05, end=2026-11-04는 endDate 오류로 거부된다', () => {
  const r = todo({ startDate: '2026-11-05', endDate: '2026-11-04' });
  assert.deepEqual(fieldNames(r), ['endDate']);
});

test('BR-07: start=end는 통과하고 값이 그대로 반환된다', () => {
  const r = todo({ startDate: '2026-11-05', endDate: '2026-11-05' });
  assert.deepEqual(r.fields, []);
  assert.deepEqual(r.value, {
    title: '장보기',
    description: null,
    startDate: '2026-11-05',
    endDate: '2026-11-05',
    categoryId: null,
  });
});

test('BR-07: checkDateOrder는 역순이면 메시지, 아니면 null이다', () => {
  assert.equal(typeof checkDateOrder('2026-11-05', '2026-11-04'), 'string');
  assert.equal(checkDateOrder('2026-11-04', '2026-11-04'), null);
  assert.equal(checkDateOrder('2026-11-04', '2026-11-05'), null);
});

test('BR-08: 존재하지 않거나 형식이 틀린 날짜는 거부된다', () => {
  for (const d of [
    '2026-02-30',
    '2026-13-01',
    '2026-00-10',
    '2026-04-31',
    '2026-01-00',
    '2026-1-01',
    '26-01-01',
    20260101,
  ]) {
    assert.ok(checkDate(d).error, String(d));
    assert.deepEqual(fieldNames(todo({ startDate: d })), ['startDate'], String(d));
  }
});

test('BR-08: 윤년 규칙(4·100·400의 배수)을 따른다', () => {
  assert.deepEqual(checkDate('2028-02-29'), { value: '2028-02-29' });
  assert.deepEqual(checkDate('2000-02-29'), { value: '2000-02-29' });
  assert.ok(checkDate('2026-02-29').error);
  assert.ok(checkDate('2100-02-29').error);
  assert.deepEqual(checkDate('2026-12-31'), { value: '2026-12-31' });
});

test('BR-08: 날짜 누락은 거부되고 한쪽이 잘못되면 순서 검사는 하지 않는다', () => {
  assert.ok(checkDate(undefined).error);
  assert.deepEqual(fieldNames(todo({ startDate: undefined })), ['startDate']);
  assert.deepEqual(fieldNames(todo({ endDate: null })), ['endDate']);
  assert.deepEqual(fieldNames(todo({ startDate: '2026-12-01', endDate: 'bad' })), ['endDate']);
  assert.equal(todo({ startDate: '2026-12-01', endDate: 'bad' }).fields.length, 1);
});

test('VR-05: categoryId 누락·null은 null, 형식 오류는 거부, 유효 uuid는 통과한다', () => {
  assert.equal(todo({}).value.categoryId, null);
  assert.equal(todo({ categoryId: null }).value.categoryId, null);
  const bad = todo({ categoryId: 'abc' });
  assert.deepEqual(fieldNames(bad), ['categoryId']);
  assert.equal(bad.fields[0].message, '카테고리를 찾을 수 없습니다.');
  const ok = todo({ categoryId: UUID });
  assert.deepEqual(ok.fields, []);
  assert.equal(ok.value.categoryId, UUID);
});

test('VR-05: isUuid는 uuid 문자열만 참이고 대소문자를 무시한다', () => {
  assert.equal(isUuid(UUID), true);
  assert.equal(isUuid(UUID.toUpperCase()), true);
  for (const v of ['abc', UUID + '0', UUID.replace(/-/g, ''), undefined, null, 123]) {
    assert.equal(isUuid(v), false, String(v));
  }
});

test('VR-05: body가 null·배열이어도 throw하지 않고 필수 필드 오류를 돌려준다', () => {
  for (const body of [null, [], 'text']) {
    assert.deepEqual(fieldNames(validateTodoCreate(body)), ['endDate', 'startDate', 'title']);
  }
});

test('VR-07: 카테고리 name 0자·공백만·31자는 거부, 1자·30자는 통과하고 trim된다', () => {
  for (const name of ['', '   ', 'c'.repeat(31), undefined]) {
    assert.deepEqual(fieldNames(validateCategory({ name })), ['name'], String(name));
  }
  assert.deepEqual(validateCategory({ name: 'c' }), { value: { name: 'c' }, fields: [] });
  assert.equal(validateCategory({ name: 'c'.repeat(30) }).value.name, 'c'.repeat(30));
  assert.equal(validateCategory({ name: '  업무  ' }).value.name, '업무');
  assert.deepEqual(fieldNames(validateCategory(null)), ['name']);
});
