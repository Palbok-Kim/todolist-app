import { AppError, ERR } from '../errors.js';
import { logger } from '../lib/logger.js';

const INTERNAL_MESSAGE = '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';

// SO-07: 오류 응답은 여기서만 만든다. 알 수 없는 예외는 ERR-07 고정 문구
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err); // 응답 도중 실패는 Express 기본 처리기가 연결을 끊는다
  if (err instanceof AppError) {
    const body = { code: err.code, message: err.message };
    if (err.fields) body.fields = err.fields;
    return res.status(err.status).json({ error: body });
  }
  // express.json()의 클라이언트 오류(잘못된 JSON, 413 크기 초과, 415 문자셋 등)는 ERR-01로 돌려주고 로그를 남기지 않는다.
  // body-parser 오류만 type 문자열이 있어 다른 http-errors 오류는 여기서 걸리지 않는다
  if (typeof err.type === 'string' && err.expose && err.status >= 400 && err.status < 500) {
    return res.status(ERR.VALIDATION_ERROR.status).json({
      error: { code: ERR.VALIDATION_ERROR.code, message: '요청 형식이 올바르지 않습니다.' },
    });
  }
  // NFR-11: 요청 정보와 함께 서버 로그에만 남긴다
  logger.error({
    method: req.method,
    path: req.originalUrl.split('?')[0],
    userId: req.user?.id ?? null,
    message: err.message,
    stack: err.stack,
  });
  res
    .status(ERR.INTERNAL_ERROR.status)
    .json({ error: { code: ERR.INTERNAL_ERROR.code, message: INTERNAL_MESSAGE } });
}
