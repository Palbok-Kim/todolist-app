import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '../../api/client';
import type { ItemList, Todo } from '../../api/types';
import { categoryKeys } from '../category/queries';
import {
  createTodo,
  deleteTodo,
  getTodo,
  listCalendarTodos,
  listTodos,
  updateTodo,
  type TodoCreateRequest,
  type TodoFilter,
  type TodoUpdateRequest,
} from './api';

export type { TodoFilter, TodoCreateRequest, TodoUpdateRequest } from './api';
// pages는 api/를 import할 수 없어 여기서 재수출한다(CN-05)
export { ERR } from '../../api/errorCodes';
// 다른 feature는 queries만 import할 수 있어 상태 표시 맵을 여기서 내보낸다(DL-11)
export { STATUS_LABEL, STATUS_TONE } from './statusLabel';

export const todoKeys = {
  all: ['todos'] as const,
  list: (f: TodoFilter) =>
    ['todos', 'list', { categoryId: f.categoryId ?? null, status: f.status ?? null }] as const,
  detail: (id: string) => ['todos', 'detail', id] as const,
  calendar: (from: string, to: string) => ['todos', 'calendar', from, to] as const,
};

// client.ts가 갱신·재전송을 이미 하므로 재시도하지 않는다(DL-14)
export function useTodos(filter: TodoFilter) {
  return useQuery<ItemList<Todo>, ApiError>({
    queryKey: todoKeys.list(filter),
    queryFn: () => listTodos(filter),
    retry: false,
  });
}

export function useTodo(id: string | undefined) {
  return useQuery<Todo, ApiError>({
    queryKey: todoKeys.detail(id ?? ''),
    queryFn: () => getTodo(id ?? ''),
    enabled: !!id,
    retry: false,
  });
}

export function useCalendarTodos(from: string, to: string) {
  return useQuery<ItemList<Todo>, ApiError>({
    queryKey: todoKeys.calendar(from, to),
    queryFn: () => listCalendarTodos(from, to),
    retry: false,
  });
}

// DL-12: 카테고리 목록의 todoCount도 바뀌므로 함께 무효화해 다시 가져온다
function useInvalidateAll() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: todoKeys.all }),
      qc.invalidateQueries({ queryKey: categoryKeys.all }),
    ]);
}

export function useCreateTodo() {
  const invalidate = useInvalidateAll();
  return useMutation<Todo, ApiError, TodoCreateRequest>({
    mutationFn: createTodo,
    onSuccess: invalidate,
  });
}

export function useUpdateTodo() {
  const invalidate = useInvalidateAll();
  return useMutation<Todo, ApiError, { id: string; body: TodoUpdateRequest }>({
    mutationFn: ({ id, body }) => updateTodo(id, body),
    onSuccess: invalidate,
  });
}

export function useDeleteTodo() {
  const qc = useQueryClient();
  const invalidate = useInvalidateAll();
  return useMutation<void, ApiError, string>({
    mutationFn: deleteTodo,
    // 지운 할일의 상세를 다시 조회해 404가 나지 않게 먼저 제거하고, 화면 이동이 늦지 않게 갱신은 기다리지 않는다(DL-12)
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: todoKeys.detail(id) });
      void invalidate();
    },
  });
}
