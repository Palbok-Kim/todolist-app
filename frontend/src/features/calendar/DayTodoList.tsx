import { Link } from 'react-router';
import type { Todo } from '../../api/types';
import { StatusBadge } from '../../components/StatusBadge';
import { weekdayIndex } from '../../lib/date';
import { STATUS_LABEL, STATUS_TONE } from '../todo/queries';
import styles from './Calendar.module.css';

export const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

export function TodoCards({ todos, empty }: { todos: Todo[]; empty: string }) {
  if (todos.length === 0) return <p className={styles.empty}>{empty}</p>;
  return (
    <ul className={styles.cards}>
      {todos.map((t) => (
        <li key={t.id}>
          <Link to={`/todos/${t.id}`} className={styles.card}>
            <span className={styles.cardTop}>
              <strong className={styles.cardTitle}>{t.title}</strong>
              <StatusBadge label={STATUS_LABEL[t.status]} tone={STATUS_TONE[t.status]} />
            </span>
            <span className={styles.cardPeriod}>
              {t.startDate} ~ {t.endDate}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// WF-05: 그날 목록(일간 보기도 재사용)
export function DayTodoList({ date, todos }: { date: string; todos: Todo[] }) {
  const [, m, d] = date.split('-').map(Number);
  return (
    <section className={styles.dayList} aria-label="그날 목록">
      <h2 className={styles.dayHead}>
        {m}월 {d}일 ({WEEKDAYS[weekdayIndex(date)]})
      </h2>
      <TodoCards todos={todos} empty="할일이 없습니다" />
    </section>
  );
}
