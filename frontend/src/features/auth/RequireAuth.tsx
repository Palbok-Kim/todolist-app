import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, Outlet, useLocation } from 'react-router';
import { ERR } from '../../api/errorCodes';
import { useMe, userKeys } from './queries';
import styles from './RequireAuth.module.css';

// AC-02: 현재 사용자 조회 결과로 인증을 판정한다
export function RequireAuth({ children }: { children?: ReactNode }) {
  const me = useMe();
  if (me.isPending) return <p className={styles.message}>불러오는 중...</p>;
  if (me.isError) {
    return me.error.code === ERR.UNAUTHORIZED ? (
      <Navigate to="/login" replace />
    ) : (
      <p className={styles.message}>{me.error.message}</p>
    );
  }
  return children ?? <Outlet />;
}

// 로그인 상태에서 로그인·가입 화면에 오면 목록으로 보낸다. 로그아웃·만료 이동(signedOut)은 캐시를 비우기 전이라 제외
// shortcut: 캐시만 보므로 새로고침 직후에는 로그인 상태여도 폼이 보인다, 서버 확인이 필요해지면 useMe로 바꾼다
export function GuestOnly() {
  const signedIn = useQueryClient().getQueryData(userKeys.me) !== undefined;
  const signedOut = (useLocation().state as { signedOut?: boolean } | null)?.signedOut;
  return signedIn && !signedOut ? <Navigate to="/todos" replace /> : <Outlet />;
}
