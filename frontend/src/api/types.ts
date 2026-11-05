// PQ-09: swagger.yaml 스키마를 손으로 옮긴 응답 타입
export type DateString = string; // YYYY-MM-DD, 시간대 변환 없음(CN-06)
export type IsoTimestamp = string; // ISO 8601 UTC(CN-06)

export type TodoStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';

export interface User {
  id: string;
  email: string;
  name: string;
  timezone: string;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface Category {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: IsoTimestamp;
}

export interface CategoryWithTodoCount extends Category {
  todoCount: number;
}

export interface Todo {
  id: string;
  categoryId: string;
  title: string;
  description: string | null;
  startDate: DateString;
  endDate: DateString;
  completed: boolean;
  completedAt: IsoTimestamp | null;
  status: TodoStatus;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface ItemList<T> {
  items: T[];
}

export interface OkResponse {
  status: 'ok';
}

export interface FieldIssue {
  field: string;
  message: string;
}
