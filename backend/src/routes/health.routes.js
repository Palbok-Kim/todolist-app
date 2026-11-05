import { Router } from 'express';
import { checkHealth } from '../services/health.service.js';

export const healthRouter = Router();

healthRouter.get('/health', async (req, res) => {
  await checkHealth();
  res.json({ status: 'ok' });
});
