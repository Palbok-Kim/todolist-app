import { TodoFilterBar } from '../features/todo/TodoFilterBar';
import { TodoTable } from '../features/todo/TodoTable';
import { useT } from '../store/prefsStore';
import styles from '../features/todo/TodoList.module.css';

// WF-03: 필터는 Zustand에 있어 편집 화면에 갔다 와도 유지된다(PQ-04)
export function TodoListPage() {
  const t = useT();
  return (
    <>
      <div className={styles.toolbar}>
        <h1>{t('할일 목록')}</h1>
        <TodoFilterBar />
      </div>
      <TodoTable />
    </>
  );
}
