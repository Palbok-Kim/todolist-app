import { describe, test, expect } from 'vitest';
import {
  validateEmail,
  validatePassword,
  validateName,
  validateSignup,
  validateLogin,
} from './validation';

// TQ-06: 백엔드 user.validation.test.js와 같은 경계값
const REQUIRED = '필수 입력입니다.';
const EMAIL_ERR = '이메일 형식이 올바르지 않습니다.';
const PW_ERR =
  '비밀번호는 영대문자·영소문자·숫자·특수문자 중 3종류 이상이면 8자 이상, 2종류 이상이면 10자 이상이어야 합니다(최대 128자).';
const NAME_ERR = '50자 이하로 입력해 주세요.';
const LOGIN_PW_ERR = '비밀번호를 확인해 주세요.';

describe('validatePassword (VR-02)', () => {
  const ok = (pw: string) => expect(validatePassword(pw), pw).toBeNull();
  const bad = (pw: string) => expect(validatePassword(pw), pw).toBe(PW_ERR);

  test('VR-02: 3종류 이상 섞으면 7자는 오류, 8자는 통과', () => {
    bad('Abcde1!');
    ok('Abcde12!');
    ok('abcdef1!');
    ok('ABCDEF1a');
  });

  test('VR-02: 2종류만 섞으면 9자는 오류, 10자는 통과', () => {
    bad('abcdefgh1');
    ok('abcdefgh12');
    ok('abcdefghi!');
    ok('ABCDEFGHIj');
  });

  test('VR-02: 1종류만이면 길이와 관계없이 오류', () => {
    for (const pw of ['p'.repeat(20), '1'.repeat(20), '!'.repeat(20), 'P'.repeat(128)]) bad(pw);
  });

  test('VR-02: 공백·한글은 쓸 수 있지만 종류로 세지 않는다', () => {
    bad('abcdefgh 가');
    ok('abcdefg 1가나');
    bad('abcdefg 1');
  });

  test('VR-02: 128자는 통과, 129자는 오류', () => {
    ok('Aa1!'.repeat(32));
    bad('Aa1!'.repeat(32) + 'a');
  });

  test('VR-02: 앞뒤 공백을 유지한다', () => {
    ok('  spaced Passw0rd  ');
  });

  test('VR-02: 길이는 UTF-16 단위로 센다(이모지 1개 = 2)', () => {
    bad('Aa1' + '😀'.repeat(2)); // 7
    ok('Aa1' + '😀'.repeat(3)); // 9
    ok('Aa1!'.repeat(31) + 'Aa😀'); // 128
    bad('Aa1!'.repeat(31) + 'Aa😀a'); // 129
  });
});

describe('validateEmail (VR-01)', () => {
  test('VR-01: 대소문자·앞뒤 공백은 정규화 후 통과', () => {
    expect(validateEmail('A@Example.com')).toBeNull();
    expect(validateEmail('  a@example.com  ')).toBeNull();
  });

  test('VR-01: 254자는 통과, 255자는 형식 오류', () => {
    const local = (n: number) => 'a'.repeat(n) + '@example.com';
    expect(local(242).length).toBe(254);
    expect(validateEmail(local(242))).toBeNull();
    expect(validateEmail(local(243))).toBe(EMAIL_ERR);
  });

  test('VR-01: 형식 위반은 형식 오류', () => {
    for (const v of ['no-at', 'a@b', 'a b@c.com', '@example.com']) {
      expect(validateEmail(v), v).toBe(EMAIL_ERR);
    }
  });

  test('VR-01: 빈 값·공백만은 필수 오류', () => {
    expect(validateEmail('')).toBe(REQUIRED);
    expect(validateEmail('   ')).toBe(REQUIRED);
  });
});

describe('validateName (VR-03)', () => {
  test('VR-03: 빈 값·공백만은 필수 오류', () => {
    expect(validateName('')).toBe(REQUIRED);
    expect(validateName('   ')).toBe(REQUIRED);
  });

  test('VR-03: 1자·50자·앞뒤 공백은 통과, 51자는 오류', () => {
    expect(validateName('가')).toBeNull();
    expect(validateName('가'.repeat(50))).toBeNull();
    expect(validateName('  홍길동  ')).toBeNull();
    expect(validateName('가'.repeat(51))).toBe(NAME_ERR);
  });

  test('VR-03: 길이는 코드 포인트로 센다(이모지 1개 = 1자)', () => {
    expect(validateName('😀'.repeat(50))).toBeNull();
    expect(validateName('😀'.repeat(51))).toBe(NAME_ERR);
  });
});

describe('validateSignup (VR-01~03)', () => {
  test('VR-01: 여러 필드 오류를 email→password→name 순서로 돌려준다', () => {
    const r = validateSignup({ email: 'bad', password: 'short', name: '   ' });
    expect(r.map((f) => f.field)).toEqual(['email', 'password', 'name']);
    expect(r).toEqual([
      { field: 'email', message: EMAIL_ERR },
      { field: 'password', message: PW_ERR },
      { field: 'name', message: REQUIRED },
    ]);
  });

  test('VR-01: 올바른 입력은 빈 배열', () => {
    expect(
      validateSignup({ email: ' A@Example.com ', password: 'Passw0rd!', name: ' 홍길동 ' }),
    ).toEqual([]);
  });
});

describe('validateLogin (AQ-04)', () => {
  test('AQ-04: 10자 비밀번호도 통과하고 email은 정규화 후 검사한다', () => {
    expect(validateLogin({ email: ' A@Example.com ', password: ' p'.repeat(5) })).toEqual([]);
  });

  test('AQ-04: 128자는 통과, 129자·빈 문자열은 오류', () => {
    expect(validateLogin({ email: 'a@example.com', password: 'p'.repeat(128) })).toEqual([]);
    for (const password of ['p'.repeat(129), '']) {
      expect(validateLogin({ email: 'a@example.com', password })).toEqual([
        { field: 'password', message: LOGIN_PW_ERR },
      ]);
    }
  });

  test('AQ-04: email 오류만 있으면 email 필드만 돌려준다', () => {
    expect(validateLogin({ email: 'bad', password: 'x' }).map((f) => f.field)).toEqual(['email']);
  });

  test('AQ-04: 둘 다 비면 email→password 순서로 모두 돌려준다', () => {
    expect(validateLogin({ email: '', password: '' })).toEqual([
      { field: 'email', message: REQUIRED },
      { field: 'password', message: LOGIN_PW_ERR },
    ]);
  });
});
