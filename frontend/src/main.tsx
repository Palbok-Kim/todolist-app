import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { router } from './App';
import { setOnUnauthorized } from './api/client';
import { useAlertStore } from './store/alertStore';
import { usePrefsStore } from './store/prefsStore';
import { userKeys } from './features/auth/queries';
import './styles/tokens.css';

const queryClient = new QueryClient();

// FR-09·10: 고른 언어·테마를 <html>에 반영한다(CN-13)
const applyPrefs = ({ lang, theme }: { lang: string; theme: string }) => {
  document.documentElement.lang = lang;
  document.documentElement.dataset.theme = theme;
};
applyPrefs(usePrefsStore.getState());
usePrefsStore.subscribe(applyPrefs);

// DL-14: 이동을 끝낸 뒤 비워야 보호 화면이 빈 캐시로 다시 조회하지 않는다.
// 로그인한 적 없으면(현재 사용자 캐시 없음) RequireAuth가 이동하고, 동시 실패는 한 번만 처리한다
let expiring = false;
setOnUnauthorized(() => {
  if (expiring || !queryClient.getQueryData(userKeys.me)) return;
  expiring = true;
  useAlertStore.getState().showAlert('info', '로그인이 만료되었습니다. 다시 로그인해 주세요.');
  void router
    .navigate('/login', { replace: true, state: { signedOut: true } })
    .then(() => queryClient.clear())
    .finally(() => {
      expiring = false;
    });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
