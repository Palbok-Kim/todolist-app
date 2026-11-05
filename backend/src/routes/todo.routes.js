import { Router } from 'express';
import {
  createTodo,
  deleteTodo,
  getTodo,
  listCalendarTodos,
  listTodos,
  updateTodo,
} from '../services/todo.service.js';

export const todoRouter = Router();

todoRouter.post('/todos', async (req, res) =>
  res.status(201).json(await createTodo(req.user.id, req.body)),
);
todoRouter.get('/todos/:todoId', async (req, res) =>
  res.json(await getTodo(req.user.id, req.params.todoId)),
);
todoRouter.delete('/todos/:todoId', async (req, res) => {
  await deleteTodo(req.user.id, req.params.todoId);
  res.status(204).end();
});
todoRouter.patch('/todos/:todoId', async (req, res) =>
  res.json(await updateTodo(req.user.id, req.params.todoId, req.body)),
);
todoRouter.get('/todos', async (req, res) =>
  res.json({
    items: await listTodos(req.user.id, {
      categoryId: req.query.categoryId,
      status: req.query.status,
    }),
  }),
);
todoRouter.get('/calendar/todos', async (req, res) =>
  res.json({ items: await listCalendarTodos(req.user.id, req.query) }),
);
