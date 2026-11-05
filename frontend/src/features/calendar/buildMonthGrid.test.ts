import { describe, test, expect } from 'vitest';
import { addDays, weekdayIndex } from '../../lib/date';
import { buildMonthGrid, todosOn, type MonthGrid } from './buildMonthGrid';

const cells = (g: MonthGrid) => g.weeks.flat();
const inMonthCount = (g: MonthGrid) => cells(g).filter((d) => d.inMonth).length;

// 공통 형태 검사: 모든 행 7칸, 행 첫 칸 월요일, 날짜 연속, 첫 칸=from·끝 칸=to
function expectShape(g: MonthGrid) {
  for (const row of g.weeks) {
    expect(row).toHaveLength(7);
    expect(weekdayIndex(row[0].date)).toBe(0);
  }
  const all = cells(g);
  for (let i = 1; i < all.length; i++) expect(all[i].date).toBe(addDays(all[i - 1].date, 1));
  expect(all[0].date).toBe(g.from);
  expect(all[all.length - 1].date).toBe(g.to);
}

describe('buildMonthGrid (FE-13, OI-06)', () => {
  test.each([
    [2026, 11, '2026-10-26', '2026-12-06', 6],
    [2024, 2, '2024-01-29', '2024-03-03', 5],
    [2021, 2, '2021-02-01', '2021-02-28', 4],
    [2100, 2, '2100-02-01', '2100-02-28', 4],
    [2026, 6, '2026-06-01', '2026-07-05', 5],
    [2026, 12, '2026-11-30', '2027-01-03', 5],
    [2027, 1, '2026-12-28', '2027-01-31', 5],
  ])('OI-06: %i-%i 그리드는 %s(월) 시작 %s(일) 끝, %i행·모든 행 7칸', (y, m, from, to, rows) => {
    const g = buildMonthGrid(y, m);
    expect(g.from).toBe(from);
    expect(g.to).toBe(to);
    expect(g.weeks).toHaveLength(rows);
    expectShape(g);
  });

  test('FE-13: 2026-11 그리드는 10-26(월) 시작 12-06(일) 끝', () => {
    const g = buildMonthGrid(2026, 11);
    expect(g.weeks[0][0]).toEqual({ date: '2026-10-26', inMonth: false });
    expect(g.weeks[0][6]).toEqual({ date: '2026-11-01', inMonth: true });
    expect(g.weeks[5][0]).toEqual({ date: '2026-11-30', inMonth: true });
    expect(inMonthCount(g)).toBe(30);
  });

  test('FE-13: 2024-02 그리드는 29일 포함·모든 행 7칸', () => {
    const g = buildMonthGrid(2024, 2);
    expect(cells(g).find((d) => d.date === '2024-02-29')?.inMonth).toBe(true);
    expect(inMonthCount(g)).toBe(29);
    expectShape(g);
  });

  test('OI-06: 2월이 월요일 시작·28일이면 4행 전부 inMonth, 2100-02-29는 없다', () => {
    expect(cells(buildMonthGrid(2021, 2)).every((d) => d.inMonth)).toBe(true);
    expect(cells(buildMonthGrid(2100, 2)).some((d) => d.date === '2100-02-29')).toBe(false);
  });

  test('OI-06: 1일이 월요일이면 첫 칸이 이번 달(2026-06)', () => {
    expect(buildMonthGrid(2026, 6).weeks[0][0].inMonth).toBe(true);
  });

  test('OI-06: 2026년 1~12월 총 칸은 42칸 이하', () => {
    for (let m = 1; m <= 12; m++) {
      const g = buildMonthGrid(2026, m);
      expect(cells(g).length, String(m)).toBeLessThanOrEqual(42);
      expectShape(g);
    }
  });
});

describe('todosOn (BR-12)', () => {
  const todos = [{ id: 't1', startDate: '2026-11-03', endDate: '2026-11-05' }];

  test('BR-12: 기간 안 날짜(시작·끝 포함)에만 나온다', () => {
    for (const d of ['2026-11-03', '2026-11-04', '2026-11-05'])
      expect(todosOn(todos, d), d).toEqual(todos);
    for (const d of ['2026-11-02', '2026-11-06']) expect(todosOn(todos, d), d).toEqual([]);
  });
});
