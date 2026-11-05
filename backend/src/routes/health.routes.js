import { Router } from 'express';
import { checkHealth } from '../services/health.service.js';

export const healthRouter = Router();

healthRouter.get('/health', async (req, res) => {
  const health = await checkHealth();
  res.status(health.db === 'up' ? 200 : 503).json(health);
});
