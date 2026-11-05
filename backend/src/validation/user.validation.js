import { asObject, checkText } from './common.js';

const REQUIRED = '필수 입력입니다.';
// VR-01
const EMAIL_MAX = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// VR-02
const PASSWORD_MIN = 15;
const PASSWORD_MAX = 128;
// VR-04: 가입 때 잘못된 값이면 기본값 사용(PRD 4.2)
const DEFAULT_TIMEZONE = 'Asia/Seoul';

export function checkEmail(v) {
  if (typeof v !== 'string') return { error: REQUIRED };
  const email = v.trim().toLowerCase();
  if (email === '') return { error: REQUIRED };
  if (email.length > EMAIL_MAX || !EMAIL_RE.test(email)) {
    return { error: '이메일 형식이 올바르지 않습니다.' };
  }
  return { value: email };
}

// 비밀번호는 trim 하지 않는다(PRD 4.1)
export function checkPassword(v) {
  if (typeof v !== 'string') return { error: REQUIRED };
  if (v.length < PASSWORD_MIN || v.length > PASSWORD_MAX) {
    return { error: '비밀번호는 15~128자여야 합니다.' };
  }
  return { value: v };
}

// VR-03
export function checkName(v) {
  return checkText(v, { max: 50 });
}

// VR-04, PQ-06: '+09:00' 같은 오프셋은 거부하고 IANA 정규형만 허용
export function normalizeTimezone(v) {
  if (typeof v !== 'string' || !/^[A-Za-z]/.test(v)) return null;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: v }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

export function validateSignup(body) {
  const b = asObject(body);
  const fields = [];
  const value = {};
  for (const [field, check] of [
    ['email', checkEmail],
    ['password', checkPassword],
    ['name', checkName],
  ]) {
    const r = check(b[field]);
    if (r.error) fields.push({ field, message: r.error });
    else value[field] = r.value;
  }
  value.timezone = normalizeTimezone(b.timezone) ?? DEFAULT_TIMEZONE;
  return { value, fields };
}

// AQ-04: 로그인은 최소 길이 검사 없음
export function validateLogin(body) {
  const b = asObject(body);
  const fields = [];
  const value = {};
  const email = checkEmail(b.email);
  if (email.error) fields.push({ field: 'email', message: email.error });
  else value.email = email.value;
  const pw = b.password;
  if (typeof pw !== 'string' || pw === '' || pw.length > PASSWORD_MAX) {
    fields.push({ field: 'password', message: '비밀번호를 확인해 주세요.' });
  } else value.password = pw;
  return { value, fields };
}

// FR-03: 보낸 필드만 검사한다. 설정 화면의 무효 시간대는 대체하지 않고 거부한다(VR-04, PRD 4.2)
export function validateUserUpdate(body) {
  const b = asObject(body);
  const fields = [];
  const value = {};
  if (b.timezone !== undefined) {
    const timezone = normalizeTimezone(b.timezone);
    if (timezone) value.timezone = timezone;
    else fields.push({ field: 'timezone', message: '시간대를 확인해 주세요.' });
  }
  if (b.name !== undefined) {
    const r = checkName(b.name);
    if (r.error) fields.push({ field: 'name', message: r.error });
    else value.name = r.value;
  }
  return { value, fields };
}

// PRD 4.4: 두 값 모두 공백을 제거하지 않는다. 현재 비밀번호는 로그인처럼 최소 길이를 보지 않는다
export function validatePasswordChange(body) {
  const b = asObject(body);
  const fields = [];
  const cur = b.currentPassword;
  if (typeof cur !== 'string' || cur === '' || cur.length > PASSWORD_MAX)
    fields.push({ field: 'currentPassword', message: '현재 비밀번호를 확인해 주세요.' });
  const next = checkPassword(b.newPassword);
  if (next.error) fields.push({ field: 'newPassword', message: next.error });
  return { value: { currentPassword: cur, newPassword: next.value }, fields };
}
