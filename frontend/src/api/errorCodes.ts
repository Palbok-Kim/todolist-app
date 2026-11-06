// CN-05: code 문자열은 이 파일에만 쓴다. 백엔드 errors.js와 같은 값
export const ERR = {
  // ERR-01
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  // ERR-02
  UNAUTHORIZED: 'UNAUTHORIZED',
  // ERR-03
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  // ERR-04
  CONFLICT: 'CONFLICT',
  // ERR-05
  NOT_FOUND: 'NOT_FOUND',
  // ERR-06
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  // ERR-07
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  // ERR-08
} as const;

export type ErrorCode = (typeof ERR)[keyof typeof ERR];
