import { describe, test, expect } from 'vitest';
import { textError } from './validation';

const REQUIRED = '필수 입력입니다.';

// TQ-06: 백엔드 checkText와 같은 경계값
describe('textError 필수 max 100 (VR-05 제목)', () => {
  test('빈 값·공백만은 필수 오류', () => {
    expect(textError('', 100)).toBe(REQUIRED);
    expect(textError('   ', 100)).toBe(REQUIRED);
  });

  test('1자·100자는 통과, 101자는 오류', () => {
    expect(textError('a', 100)).toBeNull();
    expect(textError('a'.repeat(100), 100)).toBeNull();
    expect(textError('a'.repeat(101), 100)).toBe('100자 이하로 입력해 주세요.');
  });

  test('앞뒤 공백은 길이에서 뺀다', () => {
    expect(textError('  ' + 'a'.repeat(100) + '  ', 100)).toBeNull();
  });

  test('코드 포인트로 센다(이모지 1개 = 1자)', () => {
    expect(textError('😀'.repeat(100), 100)).toBeNull();
    expect(textError('😀'.repeat(101), 100)).toBe('100자 이하로 입력해 주세요.');
  });
});

test('VR-07 카테고리 이름 max 30', () => {
  expect(textError('c'.repeat(30), 30)).toBeNull();
  expect(textError('c'.repeat(31), 30)).toBe('30자 이하로 입력해 주세요.');
});

test('VR-03 이름 max 50', () => {
  expect(textError('가'.repeat(50), 50)).toBeNull();
  expect(textError('가'.repeat(51), 50)).toBe('50자 이하로 입력해 주세요.');
});

test('VR-06 설명 선택 max 1000', () => {
  expect(textError('', 1000, false)).toBeNull();
  expect(textError('   ', 1000, false)).toBeNull();
  expect(textError('d'.repeat(1000), 1000, false)).toBeNull();
  expect(textError('d'.repeat(1001), 1000, false)).toBe('1000자 이하로 입력해 주세요.');
});
