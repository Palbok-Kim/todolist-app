import { Link } from 'react-router';
import type { Todo } from '../../api/types';
import { StatusBadge } from '../../components/StatusBadge';
import { weekdayIndex, weekdayNames } from '../../lib/date';
import { usePrefsStore, useT } from '../../store/prefsStore';
import { STATUS_LABEL, STATUS_TONE } from '../todo/queries';
import styles from './Calendar.module.css';

export function TodoCards({ todos, empty }: { todos: Todo[]; empty: string }) {
  if (todos.length === 0) return <p className={styles.empty}>{empty}</p>;
  return (
    <ul className={styles.cards}>
      {todos.map((todo) => (
        <li key={todo.id}>
          <Link to={`/todos/${todo.id}`} className={styles.card}>
            <span className={styles.cardTop}>
              <strong className={styles.cardTitle}>{todo.title}</strong>
              <StatusBadge label={STATUS_LABEL[todo.status]} tone={STATUS_TONE[todo.status]} />
            </span>
            <span className={styles.cardPeriod}>
              {todo.startDate} ~ {todo.endDate}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// WF-05: 그날 목록(일간 보기도 재사용)
export function DayTodoList({ date, todos }: { date: string; todos: Todo[] }) {
  const t = useT();
  const lang = usePrefsStore((s) => s.lang);
  const [, m, d] = date.split('-').map(Number);
  const w = weekdayNames(lang)[weekdayIndex(date)];
  return (
    <section className={styles.dayList} aria-label={t('그날 목록')}>
      <h2 className={styles.dayHead}>{t('{m}월 {d}일 ({w})', { m, d, w })}</h2>
      <TodoCards todos={todos} empty={t('할일이 없습니다')} />
    </section>
  );
}
