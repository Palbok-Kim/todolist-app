import type { FieldIssue } from '../../api/types';
import { textError } from '../../lib/validation';

// 백엔드 common.js checkDate·checkDateOrder와 같은 규칙·문구
const REQUIRED = '필수 입력입니다.';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_ERROR = '날짜 형식이 올바르지 않습니다.';
const TITLE_MAX = 100; // VR-05
const DESCRIPTION_MAX = 1000; // VR-06

// CN-06: Date 객체 없이 산술로 달력 검사(시간대 영향 없음)
export function dateError(v: string): string | null {
  if (v === '') return REQUIRED;
  if (!DATE_RE.test(v)) return DATE_ERROR;
  const [y, m, d] = v.split('-').map(Number);
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return y < 1 || m < 1 || m > 12 || d < 1 || d > days ? DATE_ERROR : null;
}

function issues(entries: [string, string | null][]): FieldIssue[] {
  return entries.flatMap(([field, message]) => (message ? [{ field, message }] : []));
}

export function validateTodo(v: {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
}): FieldIssue[] {
  const start = dateError(v.startDate);
  const end = dateError(v.endDate);
  return issues([
    ['title', textError(v.title, TITLE_MAX)],
    ['description', textError(v.description, DESCRIPTION_MAX, false)],
    ['startDate', start],
    ['endDate', end],
    // BR-07, PR-07: YYYY-MM-DD는 문자열 비교가 날짜 순서와 같다
    [
      'endDate',
      !start && !end && v.startDate > v.endDate ? '종료일은 시작일 이후여야 합니다.' : null,
    ],
  ]);
}
