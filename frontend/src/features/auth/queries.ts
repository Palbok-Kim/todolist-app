import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import type { ApiError } from '../../api/client';
import { useAlertStore } from '../../store/alertStore';
import type { User } from '../../api/types';
import { getMe, login, logout, signup, type LoginRequest, type SignupRequest } from './api';

export const userKeys = { me: ['users', 'me'] as const };

// client.ts가 갱신·재전송을 이미 하므로 재시도하지 않는다(DL-14)
export function useMe() {
  return useQuery<User, ApiError>({ queryKey: userKeys.me, queryFn: getMe, retry: false });
}

// DL-12: 캐시를 직접 쓰지 않고 무효화로 다시 가져온다
export function useLogin() {
  const qc = useQueryClient();
  return useMutation<User, ApiError, LoginRequest>({
    mutationFn: login,
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.me }),
  });
}

export function useSignup() {
  const qc = useQueryClient();
  return useMutation<User, ApiError, SignupRequest>({
    mutationFn: signup,
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.me }),
  });
}

// navigate를 먼저 await: 먼저 clear하면 남은 보호 화면의 useMe가 빈 캐시로 재조회해 401 안내가 뜬다(AD-13, DL-14)
export function useLogout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await navigate('/login', { replace: true, state: { signedOut: true } });
      qc.clear();
      useAlertStore.getState().clearAlert();
    },
    // 서버가 쿠키를 못 지웠을 수 있어 이동하지 않는다
    onError: (err) => useAlertStore.getState().showAlert('error', err.message),
  });
}
