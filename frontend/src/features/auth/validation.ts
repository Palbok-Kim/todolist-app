import type { FieldIssue } from '../../api/types';
import { textError } from '../../lib/validation';

// 백엔드 user.validation.js와 같은 규칙·문구
const REQUIRED = '필수 입력입니다.';
const EMAIL_MAX = 254; // VR-01
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// VR-02(KISA): 영대문자·영소문자·숫자·특수문자(공백 뺀 ASCII 기호) 중 섞은 종류 수로 최소 길이를 정한다
const PASSWORD_KINDS = [/[A-Z]/, /[a-z]/, /[0-9]/, /[!-/:-@[-`{-~]/];
const PASSWORD_MAX = 128;
const PASSWORD_ERROR =
  '비밀번호는 영대문자·영소문자·숫자·특수문자 중 3종류 이상이면 8자 이상, 2종류 이상이면 10자 이상이어야 합니다(최대 128자).';

export function validateEmail(v: string): string | null {
  const email = v.trim().toLowerCase();
  if (email === '') return REQUIRED;
  return email.length > EMAIL_MAX || !EMAIL_RE.test(email)
    ? '이메일 형식이 올바르지 않습니다.'
    : null;
}

// PRD 4.1: 비밀번호는 trim 하지 않는다
export function validatePassword(v: string): string | null {
  const kinds = PASSWORD_KINDS.filter((re) => re.test(v)).length;
  const min = kinds >= 3 ? 8 : kinds === 2 ? 10 : Infinity;
  return v.length < min || v.length > PASSWORD_MAX ? PASSWORD_ERROR : null;
}

// VR-03
export function validateName(v: string): string | null {
  return textError(v, 50);
}

function issues(entries: [string, string | null][]): FieldIssue[] {
  return entries.flatMap(([field, message]) => (message ? [{ field, message }] : []));
}

export function validateSignup(v: { email: string; password: string; name: string }): FieldIssue[] {
  return issues([
    ['email', validateEmail(v.email)],
    ['password', validatePassword(v.password)],
    ['name', validateName(v.name)],
  ]);
}

// AQ-04: 로그인은 VR-02(최소 길이·문자 종류)를 검사하지 않음
export function validateLogin(v: { email: string; password: string }): FieldIssue[] {
  return issues([
    ['email', validateEmail(v.email)],
    [
      'password',
      v.password === '' || v.password.length > PASSWORD_MAX ? '비밀번호를 확인해 주세요.' : null,
    ],
  ]);
}
