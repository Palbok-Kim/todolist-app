import { AppError, ERR } from '../errors.js';
import { COOKIE_NAMES } from '../lib/cookies.js';
import { verifyAccessToken } from '../lib/token.js';

// DB 조회 없이 JWT만 검증해 보호 라우트마다 쿼리를 늘리지 않는다
export function authenticate(req, res, next) {
  const payload = verifyAccessToken(req.cookies?.[COOKIE_NAMES.access]);
  if (!payload) return next(new AppError(ERR.UNAUTHORIZED, '로그인이 필요합니다.'));
  req.user = { id: payload.sub }; // DL-06: id만 담는다
  res.locals.jti = payload.jti; // CSRF 토큰이 jti에 묶여 있어 csrf 미들웨어가 쓴다
  next();
}
