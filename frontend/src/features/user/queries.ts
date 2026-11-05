import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '../../api/client';
import type { OkResponse, User } from '../../api/types';
import { userKeys } from '../auth/queries';
import { todoKeys } from '../todo/queries';
import { changePassword, updateMe, type ChangePasswordRequest, type UpdateMeRequest } from './api';

export { ERR } from '../todo/queries';

// DL-12: 시간대가 바뀌면 상태 판정(OVERDUE)이 달라지므로 할일 캐시도 무효화한다
export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation<User, ApiError, UpdateMeRequest>({
    mutationFn: updateMe,
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: userKeys.me }),
        qc.invalidateQueries({ queryKey: todoKeys.all }),
      ]),
  });
}

export function useChangePassword() {
  const qc = useQueryClient();
  return useMutation<OkResponse, ApiError, ChangePasswordRequest>({
    mutationFn: changePassword,
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.me }),
  });
}
