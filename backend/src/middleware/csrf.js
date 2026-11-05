import { AppError, ERR } from '../errors.js';
import { COOKIE_NAMES } from '../lib/cookies.js';
import { verifyCsrfToken } from '../lib/csrfToken.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// 상태를 바꾸지 않는 메서드는 CSRF 위험이 없어 검증하지 않는다
export function csrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const ok = verifyCsrfToken({
    cookie: req.cookies?.[COOKIE_NAMES.csrf],
    header: req.get('X-CSRF-Token'),
    jti: res.locals.jti,
  });
  if (!ok)
    return next(
      new AppError(ERR.CSRF_FAILED, '요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.'),
    );
  next();
}
