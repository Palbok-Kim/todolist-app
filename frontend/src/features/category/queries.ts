import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '../../api/client';
import type { CategoryWithTodoCount, ItemList } from '../../api/types';
import { createCategory, deleteCategory, listCategories, updateCategory } from './api';

export const categoryKeys = { all: ['categories'] as const };

// client.ts가 갱신·재전송을 이미 하므로 재시도하지 않는다(DL-14)
export function useCategories() {
  return useQuery<ItemList<CategoryWithTodoCount>, ApiError>({
    queryKey: categoryKeys.all,
    queryFn: listCategories,
    retry: false,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation<unknown, ApiError, string>({
    mutationFn: createCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: categoryKeys.all }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation<unknown, ApiError, { id: string; name: string }>({
    mutationFn: ({ id, name }) => updateCategory(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: categoryKeys.all }),
  });
}

// DL-12: 할일이 기본 카테고리로 옮겨지므로 전체 무효화한다. todo/queries를 import하면 순환이라 키를 쓰지 않는다(DL-11)
export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: deleteCategory,
    onSuccess: () => qc.invalidateQueries(),
  });
}
