import type { Todo } from '../../api/types';
import { addDays, weekdayIndex, weekdayNames } from '../../lib/date';
import { usePrefsStore, useT } from '../../store/prefsStore';
import { TodoCards } from './DayTodoList';
import { TodoBar } from './MonthGrid';
import { todosOn } from './buildMonthGrid';
import styles from './Calendar.module.css';

// FE-17: 데스크톱은 7열, 모바일은 날짜별 세로 목록. 둘 다 그리고 CSS로 하나만 보인다
export function WeekView({ from, todos, today }: { from: string; todos: Todo[]; today: string }) {
  const t = useT();
  const names = weekdayNames(usePrefsStore((s) => s.lang));
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  return (
    <>
      <div className={styles.week}>
        {days.map((date) => (
          <div key={date} className={`${styles.weekCol} ${date === today ? styles.weekToday : ''}`}>
            <div className={styles.weekHead}>
              <strong>{Number(date.slice(8))}</strong> {names[weekdayIndex(date)]}
            </div>
            <div className={styles.bars}>
              {todosOn(todos, date).map((todo) => (
                <TodoBar key={todo.id} todo={todo} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className={styles.weekList}>
        {days.map((date) => (
          <section key={date}>
            <h2 className={styles.weekListHead}>
              {date.slice(5)} ({names[weekdayIndex(date)]})
              {date === today && <span className={styles.todayTag}>{t('오늘')}</span>}
            </h2>
            <TodoCards todos={todosOn(todos, date)} empty={t('할일 없음')} />
          </section>
        ))}
      </div>
    </>
  );
}
