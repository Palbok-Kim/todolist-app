import { textError } from '../../lib/validation';

// VR-07: 중복(BR-14)은 서버 409가 판정한다
export function validateCategoryName(v: string): string | null {
  return textError(v, 30);
}
