import type { MouseEvent } from 'react';
import { Link } from 'react-router';
import type { Todo } from '../../api/types';
import { STATUS_LABEL, STATUS_TONE } from '../todo/queries';
import { WEEKDAYS } from './DayTodoList';
import { todosOn, type MonthGrid as Grid } from './buildMonthGrid';
import styles from './Calendar.module.css';

const LIMIT = 3;
const stop = (e: MouseEvent) => e.stopPropagation();

// BR-12: 여러 날 할일은 칸마다 막대를 따로 그린다
export function TodoBar({ todo }: { todo: Todo }) {
  return (
    <Link
      to={`/todos/${todo.id}`}
      onClick={stop}
      className={styles.bar}
      style={{ background: `var(--status-${STATUS_TONE[todo.status]})` }}
    >
      {/* 칸이 좁아도 상태 라벨은 잘리지 않고 제목만 줄인다(BR-12: 색 + 텍스트) */}
      <span className={styles.barTitle}>{todo.title}</span>
      <span className={styles.barLabel}> · {STATUS_LABEL[todo.status]}</span>
    </Link>
  );
}

interface Props {
  grid: Grid;
  todos: Todo[];
  today: string;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

export function MonthGrid({ grid, todos, today, selectedDate, onSelectDate }: Props) {
  return (
    <div className={styles.month}>
      {WEEKDAYS.map((w, i) => (
        <div
          key={w}
          className={`${styles.dow} ${i === 5 ? styles.sat : ''} ${i === 6 ? styles.sun : ''}`}
        >
          {w}
        </div>
      ))}
      {grid.weeks.flat().map(({ date, inMonth }, i) => {
        const items = todosOn(todos, date);
        const cls = [
          styles.cell,
          inMonth ? '' : styles.out,
          i % 7 === 5 ? styles.sat : '',
          i % 7 === 6 ? styles.sun : '',
          date === today ? styles.today : '',
          date === selectedDate ? styles.selected : '',
        ].join(' ');
        return (
          <div key={date} className={cls} onClick={() => onSelectDate(date)}>
            <span className={styles.num}>{Number(date.slice(8))}</span>
            <div className={styles.bars}>
              {items.slice(0, LIMIT).map((t) => (
                <TodoBar key={t.id} todo={t} />
              ))}
              {items.length > LIMIT && (
                <button
                  type="button"
                  className={styles.more}
                  onClick={(e) => {
                    stop(e);
                    onSelectDate(date);
                  }}
                >
                  +{items.length - LIMIT}개 더
                </button>
              )}
            </div>
            {items.length > 0 && <span className={styles.count}>{items.length}</span>}
          </div>
        );
      })}
    </div>
  );
}
