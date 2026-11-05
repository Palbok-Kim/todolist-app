import { addDays, firstOfMonth, weekdayIndex } from '../../lib/date';

export interface GridDay {
  date: string;
  inMonth: boolean;
}
export interface MonthGrid {
  weeks: GridDay[][];
  from: string;
  to: string;
}

// 월요일 시작(OI-06): 1일이 속한 주 월요일부터 말일이 속한 주 일요일까지, 행은 4~6
export function buildMonthGrid(year: number, month: number): MonthGrid {
  const prefix = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
  const first = `${prefix}-01`;
  const from = addDays(first, -weekdayIndex(first));
  const last = addDays(firstOfMonth(first, 1), -1);
  const to = addDays(last, 6 - weekdayIndex(last));
  const weeks: GridDay[][] = [];
  for (let start = from; start <= to; start = addDays(start, 7)) {
    weeks.push(
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(start, i);
        return { date, inMonth: date.slice(0, 7) === prefix };
      }),
    );
  }
  return { weeks, from, to };
}

// BR-12: 시작일~종료일의 모든 날에 나온다
export function todosOn<T extends { startDate: string; endDate: string }>(
  todos: T[],
  date: string,
): T[] {
  return todos.filter((t) => t.startDate <= date && date <= t.endDate);
}
