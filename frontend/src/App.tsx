import { createBrowserRouter, Navigate } from 'react-router';
import { ErrorPage } from './components/ErrorPage';
import { Layout } from './components/Layout';
import { useLogout, useMe } from './features/auth/queries';
import { GuestOnly, RequireAuth } from './features/auth/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { TodoListPage } from './pages/TodoListPage';
import { TodoFormPage } from './pages/TodoFormPage';
import { CalendarPage } from './pages/CalendarPage';
import { SettingsPage } from './pages/SettingsPage';
import { CategoryManagePage } from './pages/CategoryManagePage';

// 조립 파일이라 features 훅을 직접 쓴다(DL-14 예외)
function AppLayout() {
  const logout = useLogout();
  const user = useMe().data;
  return <Layout onLogout={() => logout.mutate()} logoutPending={logout.isPending} user={user} />;
}

// WF ↔ 경로 표
export const router = createBrowserRouter([
  {
    // WF 3.2 오류 화면: 없는 주소(404)와 하위 화면의 렌더링 오류를 모두 받는다
    errorElement: <ErrorPage />,
    children: [
      { path: '/', element: <Navigate to="/todos" replace /> },
      {
        element: <GuestOnly />,
        children: [
          {
            element: <Layout />,
            children: [
              { path: '/login', element: <LoginPage /> }, // WF-01
              { path: '/signup', element: <SignupPage /> }, // WF-02
            ],
          },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: '/todos', element: <TodoListPage /> }, // WF-03
              { path: '/todos/new', element: <TodoFormPage /> }, // WF-04 등록
              { path: '/todos/:todoId', element: <TodoFormPage /> }, // WF-04 편집
              { path: '/calendar', element: <CalendarPage /> }, // WF-05, WF-06
              { path: '/settings', element: <SettingsPage /> }, // WF-07
              { path: '/settings/categories', element: <CategoryManagePage /> }, // WF-08
            ],
          },
        ],
      },
    ],
  },
]);
