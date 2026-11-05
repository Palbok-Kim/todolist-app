import { Router } from 'express';
import { setSessionCookies } from '../lib/cookies.js';
import { changePassword, getMe, updateMe } from '../services/user.service.js';

export const userRouter = Router();

userRouter.get('/users/me', async (req, res) => res.json(await getMe(req.user.id)));
userRouter.patch('/users/me', async (req, res) => res.json(await updateMe(req.user.id, req.body)));
userRouter.put('/users/me/password', async (req, res) => {
  setSessionCookies(res, await changePassword(req.user.id, req.body));
  res.json({ status: 'ok' });
});
