// TQ-06: 백엔드 todo.validation.test.js 중 비문자열·null·categoryId·trim 결과값 케이스는 프런트 입력이 string 고정이라 제외
import { describe, test, expect } from 'vitest';
import { dateError, validateTodo } from './validation';

const REQUIRED = '필수 입력입니다.';
const DATE_ERR = '날짜 형식이 올바르지 않습니다.';
const ORDER_ERR = '종료일은 시작일 이후여야 합니다.';

const base = { title: '장보기', description: '', startDate: '2026-11-04', endDate: '2026-11-04' };
const todo = (over: Partial<typeof base>) => validateTodo({ ...base, ...over });
const fields = (r: { field: string }[]) => r.map((f) => f.field);

describe('validateTodo title (VR-05)', () => {
  test('VR-05: 빈 값·공백만은 필수 오류', () => {
    for (const title of ['', '   ']) {
      expect(todo({ title }), title).toEqual([{ field: 'title', message: REQUIRED }]);
    }
  });

  test('VR-05: 101자는 오류, 1자·100자·앞뒤 공백은 통과', () => {
    expect(todo({ title: 'a'.repeat(101) })).toEqual([
      { field: 'title', message: '100자 이하로 입력해 주세요.' },
    ]);
    for (const title of ['a', 'a'.repeat(100), '  장보기  ']) {
      expect(todo({ title }), title).toEqual([]);
    }
  });

  test('VR-05: 길이는 코드 포인트로 센다(이모지 100개는 통과, 101개는 거부)', () => {
    expect(todo({ title: '😀'.repeat(100) })).toEqual([]);
    expect(fields(todo({ title: '😀'.repeat(101) }))).toEqual(['title']);
  });
});

describe('validateTodo description (VR-06)', () => {
  test('VR-06: 빈 값·공백만·1000자는 통과', () => {
    for (const description of ['', '   ', 'd'.repeat(1000)]) {
      expect(todo({ description })).toEqual([]);
    }
  });

  test('VR-06: 1001자는 오류', () => {
    expect(todo({ description: 'd'.repeat(1001) })).toEqual([
      { field: 'description', message: '1000자 이하로 입력해 주세요.' },
    ]);
  });
});

describe('validateTodo 날짜 순서 (BR-07)', () => {
  test('BR-07: 시작일이 종료일보다 늦으면 endDate 오류', () => {
    expect(todo({ startDate: '2026-11-05', endDate: '2026-11-04' })).toEqual([
      { field: 'endDate', message: ORDER_ERR },
    ]);
  });

  test('BR-07: 같은 날·시작일이 빠르면 통과', () => {
    expect(todo({ startDate: '2026-11-05', endDate: '2026-11-05' })).toEqual([]);
    expect(todo({ startDate: '2026-11-04', endDate: '2026-11-05' })).toEqual([]);
  });
});

describe('dateError·validateTodo 날짜 형식 (BR-08)', () => {
  test('BR-08: 존재하지 않거나 형식이 틀린 날짜는 거부된다', () => {
    for (const d of [
      '2026-02-30',
      '2026-13-01',
      '2026-00-10',
      '2026-04-31',
      '2026-01-00',
      '2026-1-01',
      '26-01-01',
    ]) {
      expect(dateError(d), d).toBe(DATE_ERR);
      expect(todo({ startDate: d }), d).toEqual([{ field: 'startDate', message: DATE_ERR }]);
    }
  });

  test('BR-08: 윤년 규칙(4·100·400의 배수)을 따른다', () => {
    for (const d of ['2028-02-29', '2000-02-29', '2026-12-31']) expect(dateError(d), d).toBeNull();
    for (const d of ['2026-02-29', '2100-02-29']) expect(dateError(d), d).toBe(DATE_ERR);
  });

  test('BR-08: 빈 값은 필수 오류', () => {
    expect(dateError('')).toBe(REQUIRED);
    expect(todo({ startDate: '' })).toEqual([{ field: 'startDate', message: REQUIRED }]);
    expect(fields(todo({ endDate: '' }))).toEqual(['endDate']);
  });

  test('BR-08: 한쪽이 잘못되면 순서 검사는 하지 않는다', () => {
    expect(todo({ startDate: '2026-12-01', endDate: 'bad' })).toEqual([
      { field: 'endDate', message: DATE_ERR },
    ]);
  });

  test('BR-08: 0000년은 거부하고 0001년은 통과한다', () => {
    expect(fields(todo({ startDate: '0000-01-01', endDate: '0000-01-02' }))).toEqual([
      'startDate',
      'endDate',
    ]);
    expect(todo({ startDate: '0001-01-01', endDate: '0001-01-01' })).toEqual([]);
  });
});

describe('validateTodo 필드 순서 (VR-05·VR-06·BR-07·BR-08)', () => {
  test('VR-05: 모두 비면 title→startDate→endDate 순서', () => {
    expect(
      fields(validateTodo({ title: '', description: '', startDate: '', endDate: '' })),
    ).toEqual(['title', 'startDate', 'endDate']);
  });

  test('BR-07: title→description→endDate(순서 오류) 순서', () => {
    expect(
      fields(
        validateTodo({
          title: '',
          description: 'd'.repeat(1001),
          startDate: '2026-11-05',
          endDate: '2026-11-04',
        }),
      ),
    ).toEqual(['title', 'description', 'endDate']);
  });
});
