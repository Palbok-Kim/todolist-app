// 요청 검증 공통 함수. 반환은 { value } 또는 { error }
const REQUIRED = '필수 입력입니다.';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 선택 필드는 누락·null·빈 값만 null로 보고, 문자열이 아닌 값은 거부한다(데이터를 조용히 지우지 않는다)
export function checkText(v, { max, required = true }) {
  if (v === undefined || v === null) return required ? { error: REQUIRED } : { value: null };
  if (typeof v !== 'string') return { error: '문자로 입력해 주세요.' };
  const trimmed = v.trim();
  if (trimmed === '') return required ? { error: REQUIRED } : { value: null };
  // DB의 char_length와 같게 코드 포인트로 센다(이모지 1개 = 1자)
  if ([...trimmed].length > max) return { error: `${max}자 이하로 입력해 주세요.` };
  return { value: trimmed };
}

// BR-08, CN-06: Date 객체 없이 직접 달력 검사
export function checkDate(v) {
  if (v === undefined || v === null || v === '') return { error: REQUIRED };
  if (typeof v !== 'string' || !DATE_RE.test(v)) return { error: '날짜 형식이 올바르지 않습니다.' };
  const [y, m, d] = v.split('-').map(Number);
  // PostgreSQL DATE에는 0년이 없다
  if (y < 1) return { error: '날짜 형식이 올바르지 않습니다.' };
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  if (m < 1 || m > 12 || d < 1 || d > days) return { error: '날짜 형식이 올바르지 않습니다.' };
  return { value: v };
}

// BR-07
export function checkDateOrder(start, end) {
  return start > end ? '종료일은 시작일 이후여야 합니다.' : null;
}

export function isUuid(v) {
  return typeof v === 'string' && UUID_RE.test(v);
}

// body가 객체가 아니면 {}로 취급
export function asObject(body) {
  return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
}
