import { Router } from 'express';
import {
  createCategory,
  deleteCategory,
  listCategories,
  renameCategory,
} from '../services/category.service.js';

export const categoryRouter = Router();

categoryRouter.get('/categories', async (req, res) =>
  res.json({ items: await listCategories(req.user.id) }),
);
categoryRouter.post('/categories', async (req, res) =>
  res.status(201).json(await createCategory(req.user.id, req.body)),
);
categoryRouter.patch('/categories/:categoryId', async (req, res) =>
  res.json(await renameCategory(req.user.id, req.params.categoryId, req.body)),
);
categoryRouter.delete('/categories/:categoryId', async (req, res) => {
  await deleteCategory(req.user.id, req.params.categoryId);
  res.status(204).end();
});
