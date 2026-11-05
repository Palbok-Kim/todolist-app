// SO-04, SO-12, 9-design.md 5.1: 쿠키 속성과 Secure·Max-Age는 여기 한 곳. routes만 import한다
import { config } from '../config.js';
import { ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS } from './token.js';

export const COOKIE_NAMES = {
  access: 'access_token',
  refresh: 'refresh_token',
  csrf: 'csrf_token',
};

const accessMs = ACCESS_TTL_SECONDS * 1000;
const refreshMs = REFRESH_TTL_SECONDS * 1000;

const attrs = (secure) => ({
  access: { httpOnly: true, sameSite: 'lax', path: '/api', secure },
  refresh: { httpOnly: true, sameSite: 'strict', path: '/api/auth', secure },
  // 화면 출처의 JS가 읽어 헤더로 보내야 하므로 상위 도메인에 둔다(인증 쿠키는 API 호스트 전용)
  csrf: {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    secure,
    domain: config.cookieDomain ?? undefined,
  },
});

export function setSessionCookies(
  res,
  { accessToken, refreshToken, csrfToken },
  secure = config.cookieSecure,
) {
  const a = attrs(secure);
  res.cookie(COOKIE_NAMES.access, accessToken, { ...a.access, maxAge: accessMs });
  res.cookie(COOKIE_NAMES.refresh, refreshToken, { ...a.refresh, maxAge: refreshMs });
  res.cookie(COOKIE_NAMES.csrf, csrfToken, { ...a.csrf, maxAge: accessMs });
}

export function clearSessionCookies(res, secure = config.cookieSecure) {
  const a = attrs(secure);
  for (const key of Object.keys(COOKIE_NAMES)) res.clearCookie(COOKIE_NAMES[key], a[key]);
}
