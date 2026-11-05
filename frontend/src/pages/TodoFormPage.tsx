import { Link, useParams } from 'react-router';
import { CategorySelect } from '../features/category/CategorySelect';
import { TodoForm } from '../features/todo/TodoForm';
import { ERR, useTodo } from '../features/todo/queries';
import styles from '../features/todo/TodoForm.module.css';

// WF-04: 등록 모드는 useTodo가 enabled:false라 isPending이 true이므로 todoId 조건이 필수
export function TodoFormPage() {
  const { todoId } = useParams();
  const q = useTodo(todoId);
  if (todoId && q.isPending) return <p className={styles.message}>불러오는 중...</p>;
  if (todoId && q.isError)
    return q.error.code === ERR.NOT_FOUND ? (
      <p className={styles.message}>
        할일을 찾을 수 없습니다 <Link to="/todos">목록으로</Link>
      </p>
    ) : (
      <p className={styles.message}>{q.error.message}</p>
    );
  return (
    <TodoForm
      key={todoId ?? 'new'}
      todo={q.data}
      renderCategory={(p) => <CategorySelect {...p} />}
    />
  );
}
