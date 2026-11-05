import { apiRequest } from '../../api/client';
import type { CategoryWithTodoCount, ItemList } from '../../api/types';

export const listCategories = () =>
  apiRequest<ItemList<CategoryWithTodoCount>>('GET', '/categories');
export const createCategory = (name: string) =>
  apiRequest<CategoryWithTodoCount>('POST', '/categories', { name });
export const updateCategory = (id: string, name: string) =>
  apiRequest<CategoryWithTodoCount>('PATCH', `/categories/${encodeURIComponent(id)}`, { name });
export const deleteCategory = (id: string) =>
  apiRequest<void>('DELETE', `/categories/${encodeURIComponent(id)}`);
