// SO-04, SO-12, 9-design.md 5.1: 쿠키 속성과 Secure·Max-Age는 여기 한 곳. routes만 import한다
import { config } from '../config.js';
import { ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS } from './token.js';

export const COOKIE_NAMES = {
  access: 'access_token',
  refresh: 'refresh_token',
};

const accessMs = ACCESS_TTL_SECONDS * 1000;
const refreshMs = REFRESH_TTL_SECONDS * 1000;

// 운영은 화면(todolist-ymj.vercel.app)과 API가 다른 사이트(vercel.app은 공개 접미사)라 None + Partitioned(CHIPS).
// 개발(http)은 None을 쓸 수 없고 localhost끼리 같은 사이트라 Lax·Strict
const attrs = (secure) => ({
  access: {
    httpOnly: true,
    sameSite: secure ? 'none' : 'lax',
    partitioned: secure,
    path: '/api',
    secure,
  },
  refresh: {
    httpOnly: true,
    sameSite: secure ? 'none' : 'strict',
    partitioned: secure,
    path: '/api/auth',
    secure,
  },
});

export function setSessionCookies(
  res,
  { accessToken, refreshToken },
  secure = config.cookieSecure,
) {
  const a = attrs(secure);
  res.cookie(COOKIE_NAMES.access, accessToken, { ...a.access, maxAge: accessMs });
  res.cookie(COOKIE_NAMES.refresh, refreshToken, { ...a.refresh, maxAge: refreshMs });
}

export function clearSessionCookies(res, secure = config.cookieSecure) {
  const a = attrs(secure);
  for (const key of Object.keys(COOKIE_NAMES)) res.clearCookie(COOKIE_NAMES[key], a[key]);
}
