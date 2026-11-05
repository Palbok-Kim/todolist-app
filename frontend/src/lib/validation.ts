// 백엔드 validation/common.js checkText와 같은 문구·코드 포인트 길이
export function textError(value: string, max: number, required = true): string | null {
  const s = value.trim();
  if (s === '') return required ? '필수 입력입니다.' : null;
  return [...s].length > max ? `${max}자 이하로 입력해 주세요.` : null;
}
