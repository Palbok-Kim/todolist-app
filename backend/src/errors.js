// CN-05: code 문자열은 이 파일에만 쓴다. 값은 PRD 4.3
export const ERR = Object.freeze({
  // ERR-01
  VALIDATION_ERROR: { code: 'VALIDATION_ERROR', status: 400 },
  // ERR-02
  UNAUTHORIZED: { code: 'UNAUTHORIZED', status: 401 },
  // ERR-03
  INVALID_CREDENTIALS: { code: 'INVALID_CREDENTIALS', status: 401 },
  // ERR-04
  CONFLICT: { code: 'CONFLICT', status: 409 },
  // ERR-05
  NOT_FOUND: { code: 'NOT_FOUND', status: 404 },
  // ERR-06
  TOO_MANY_REQUESTS: { code: 'TOO_MANY_REQUESTS', status: 429 },
  // ERR-07
  INTERNAL_ERROR: { code: 'INTERNAL_ERROR', status: 500 },
  // ERR-08
});

export class AppError extends Error {
  // fields: ERR-01일 때 [{ field, message }]
  constructor(err, message, fields) {
    super(message);
    this.code = err.code;
    this.status = err.status;
    this.fields = fields;
  }
}
