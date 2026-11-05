import { createBrowserRouter, Navigate } from 'react-router';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { TodoListPage } from './pages/TodoListPage';
import { TodoFormPage } from './pages/TodoFormPage';
import { CalendarPage } from './pages/CalendarPage';
import { SettingsPage } from './pages/SettingsPage';
import { CategoryManagePage } from './pages/CategoryManagePage';

// WF ↔ 경로 표. 인증 가드(RequireAuth)와 공통 레이아웃(WF-00)은 이후 Task에서 감싼다
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/todos" replace /> },
  { path: '/login', element: <LoginPage /> }, // WF-01
  { path: '/signup', element: <SignupPage /> }, // WF-02
  { path: '/todos', element: <TodoListPage /> }, // WF-03
  { path: '/todos/new', element: <TodoFormPage /> }, // WF-04 등록
  { path: '/todos/:todoId', element: <TodoFormPage /> }, // WF-04 편집
  { path: '/calendar', element: <CalendarPage /> }, // WF-05, WF-06
  { path: '/settings', element: <SettingsPage /> }, // WF-07
  { path: '/settings/categories', element: <CategoryManagePage /> }, // WF-08
]);
