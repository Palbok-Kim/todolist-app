import { CategorySidebar } from '../features/category/CategorySidebar';
import { DayTodoList } from '../features/calendar/DayTodoList';
import { MonthGrid } from '../features/calendar/MonthGrid';
import { WeekView } from '../features/calendar/WeekView';
import { buildMonthGrid, todosOn } from '../features/calendar/buildMonthGrid';
import styles from '../features/calendar/Calendar.module.css';
import { useMe } from '../features/auth/queries';
import { useCalendarTodos } from '../features/todo/queries';
import { addDays, firstOfMonth, todayIn, weekRange } from '../lib/date';
import { useCalendarStore } from '../store/calendarStore';
import { useT } from '../store/prefsStore';

const VIEWS = [
  ['month', '월'],
  ['week', '주'],
  ['day', '일'],
] as const;

// WF-05, WF-06
export function CalendarPage() {
  const me = useMe().data;
  const t = useT();
  if (!me) return <p>{t('불러오는 중...')}</p>;
  return <Calendar timezone={me.timezone} />;
}

function Calendar({ timezone }: { timezone: string }) {
  const t = useT();
  const {
    view,
    anchorDate,
    selectedDate,
    hiddenCategoryIds,
    setView,
    setAnchorDate,
    setSelectedDate,
  } = useCalendarStore();
  const today = todayIn(timezone);
  const anchor = anchorDate ?? today;
  const [y, m, d] = anchor.split('-').map(Number);
  const grid = buildMonthGrid(y, m);
  const range =
    view === 'month'
      ? { from: grid.from, to: grid.to }
      : view === 'week'
        ? weekRange(anchor)
        : { from: anchor, to: anchor };
  const { data, isPending, error } = useCalendarTodos(range.from, range.to);
  // FR-11: 체크 해제한 카테고리는 화면에서만 거른다(PRD 4.6)
  const todos = (data?.items ?? []).filter((x) => !hiddenCategoryIds.includes(x.categoryId));

  const move = (dir: 1 | -1) => {
    setAnchorDate(
      view === 'month'
        ? firstOfMonth(anchor, dir)
        : addDays(anchor, dir * (view === 'week' ? 7 : 1)),
    );
    setSelectedDate(null);
  };
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  const title =
    view === 'month'
      ? `${y}.${mm}`
      : view === 'week'
        ? `${range.from.slice(5).replace('-', '.')} - ${range.to.slice(5).replace('-', '.')}`
        : `${y}.${mm}.${dd}`;

  const listDate = selectedDate ?? today;
  const listInGrid = listDate >= grid.from && listDate <= grid.to;

  return (
    <div className={styles.layout}>
      <CategorySidebar />
      <div className={styles.body}>
        <div className={styles.toolbar}>
          <div className={styles.nav}>
            <h1 className={styles.title}>{title}</h1>
            <div className={styles.pair}>
              <button
                type="button"
                className={styles.btn}
                aria-label={t('이전')}
                onClick={() => move(-1)}
              >
                &lt;
              </button>
              <button
                type="button"
                className={styles.btn}
                aria-label={t('다음')}
                onClick={() => move(1)}
              >
                &gt;
              </button>
            </div>
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                setAnchorDate(null);
                setSelectedDate(null);
              }}
            >
              {t('오늘')}
            </button>
          </div>
          <div className={styles.pair} role="group" aria-label={t('보기 전환')}>
            {VIEWS.map(([v, label]) => (
              <button
                key={v}
                type="button"
                className={`${styles.btn} ${view === v ? styles.active : ''}`}
                aria-pressed={view === v}
                onClick={() => {
                  // 고른 날짜가 있으면 그 날짜의 주·일로 바꾼다
                  if (selectedDate) setAnchorDate(selectedDate);
                  setView(v);
                }}
              >
                {t(label)}
              </button>
            ))}
          </div>
        </div>
        {error && <p className={styles.error}>{t(error.message)}</p>}
        {isPending ? (
          <p>{t('불러오는 중...')}</p>
        ) : view === 'month' ? (
          <>
            <MonthGrid
              grid={grid}
              todos={todos}
              today={today}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
            {listInGrid && (
              <div className={selectedDate ? undefined : styles.mobileOnly}>
                <DayTodoList date={listDate} todos={todosOn(todos, listDate)} />
              </div>
            )}
          </>
        ) : view === 'week' ? (
          <WeekView from={range.from} todos={todos} today={today} />
        ) : (
          <DayTodoList date={anchor} todos={todos} />
        )}
      </div>
    </div>
  );
}
