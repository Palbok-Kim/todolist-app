import type { TodoStatus } from '../../api/types';

// PR-06: 상태 판정은 서버가 하므로 표시용 맵만 둔다
export const STATUS_LABEL: Record<TodoStatus, string> = {
  NOT_STARTED: '시작 전',
  IN_PROGRESS: '진행 중',
  COMPLETED: '완료',
  OVERDUE: '기한 초과',
};

// style-guide 2.1 상태 색: var(--status-${tone}), var(--status-${tone}-soft)
export const STATUS_TONE: Record<TodoStatus, 'todo' | 'doing' | 'done' | 'overdue'> = {
  NOT_STARTED: 'todo',
  IN_PROGRESS: 'doing',
  COMPLETED: 'done',
  OVERDUE: 'overdue',
};
