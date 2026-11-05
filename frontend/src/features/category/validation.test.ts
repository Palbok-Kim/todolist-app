// TQ-06: 백엔드 todo.validation.test.js의 VR-07 중 undefined·null body 케이스는 프런트 입력이 string 고정이라 제외
import { describe, test, expect } from 'vitest';
import { validateCategoryName } from './validation';

const REQUIRED = '필수 입력입니다.';
const TOO_LONG = '30자 이하로 입력해 주세요.';

describe('validateCategoryName (VR-07)', () => {
  test('VR-07: 빈 값·공백만은 필수 오류', () => {
    for (const name of ['', '   ']) expect(validateCategoryName(name), name).toBe(REQUIRED);
  });

  test('VR-07: 31자는 오류, 1자·30자·앞뒤 공백은 통과', () => {
    expect(validateCategoryName('a'.repeat(31))).toBe(TOO_LONG);
    expect(validateCategoryName('가'.repeat(31))).toBe(TOO_LONG);
    for (const name of ['a', 'a'.repeat(30), '  ' + 'a'.repeat(30) + '  ', '  업무  ']) {
      expect(validateCategoryName(name), name).toBeNull();
    }
  });

  test('VR-07: 길이는 코드 포인트로 센다(이모지 30개는 통과, 31개는 거부)', () => {
    expect(validateCategoryName('😀'.repeat(30))).toBeNull();
    expect(validateCategoryName('😀'.repeat(31))).toBe(TOO_LONG);
  });
});
