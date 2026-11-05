import { apiRequest } from '../../api/client';
import type { DateString, ItemList, Todo, TodoStatus } from '../../api/types';

export interface TodoFilter {
  categoryId?: string | null;
  status?: TodoStatus | null;
}
export interface TodoCreateRequest {
  title: string;
  description?: string | null;
  startDate: DateString;
  endDate: DateString;
  categoryId?: string | null;
}
export interface TodoUpdateRequest {
  title?: string;
  description?: string | null;
  startDate?: DateString;
  endDate?: DateString;
  categoryId?: string;
  completed?: boolean;
}

// 빈 값은 보내지 않아 "필터 없음"이 전체 조회가 되게 한다(BR-11)
function qs(params: Record<string, string | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null && v !== '') sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const listTodos = (f: TodoFilter = {}) =>
  apiRequest<ItemList<Todo>>('GET', `/todos${qs({ categoryId: f.categoryId, status: f.status })}`);
export const getTodo = (id: string) => apiRequest<Todo>('GET', `/todos/${encodeURIComponent(id)}`);
export const createTodo = (body: TodoCreateRequest) => apiRequest<Todo>('POST', '/todos', body);
export const updateTodo = (id: string, body: TodoUpdateRequest) =>
  apiRequest<Todo>('PATCH', `/todos/${encodeURIComponent(id)}`, body);
export const deleteTodo = (id: string) =>
  apiRequest<void>('DELETE', `/todos/${encodeURIComponent(id)}`);
export const listCalendarTodos = (from: DateString, to: DateString) =>
  apiRequest<ItemList<Todo>>('GET', `/calendar/todos${qs({ from, to })}`);
