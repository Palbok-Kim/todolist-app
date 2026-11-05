import { Router } from 'express';
import { clearSessionCookies, COOKIE_NAMES, setSessionCookies } from '../lib/cookies.js';
import { login, logout, refresh, signup } from '../services/auth.service.js';

export const authRouter = Router();

// DL-05: 공개 라우트라 액세스 토큰·CSRF 없이 리프레시 쿠키만으로 호출한다. 실패해도 쿠키는 지우지 않는다(AD-14)
authRouter.post('/auth/refresh', async (req, res) => {
  setSessionCookies(res, await refresh(req.cookies?.[COOKIE_NAMES.refresh]));
  res.json({ status: 'ok' });
});

authRouter.post('/auth/signup', async (req, res) => {
  const { user, tokens } = await signup(req.body);
  setSessionCookies(res, tokens);
  res.status(201).json(user);
});

authRouter.post('/auth/login', async (req, res) => {
  const { user, tokens } = await login(req.body, req.ip);
  setSessionCookies(res, tokens);
  res.json(user);
});

authRouter.post('/auth/logout', async (req, res) => {
  await logout(req.cookies?.[COOKIE_NAMES.refresh]);
  clearSessionCookies(res);
  res.json({ status: 'ok' });
});
