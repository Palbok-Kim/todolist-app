import { describe, test, expect } from 'vitest';
import { addDays, weekdayIndex, todayIn, formatTimestamp, weekRange, firstOfMonth } from './date';

describe('addDays', () => {
  test.each([
    ['2026-12-31', 1, '2027-01-01'],
    ['2026-01-01', -1, '2025-12-31'],
    ['2026-02-28', 1, '2026-03-01'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2000-02-28', 1, '2000-02-29'],
    ['2100-02-28', 1, '2100-03-01'],
    ['0001-01-01', 1, '0001-01-02'],
    ['0099-12-31', 1, '0100-01-01'],
    ['2026-11-02', 41, '2026-12-13'],
    ['2026-11-05', 0, '2026-11-05'],
  ])('addDays(%s, %i) = %s', (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected);
  });
});

describe('weekdayIndex', () => {
  test.each([
    ['2026-11-02', 0],
    ['2026-11-03', 1],
    ['2026-11-07', 5],
    ['2026-11-08', 6],
  ])('weekdayIndex(%s) = %i (월=0)', (date, expected) => {
    expect(weekdayIndex(date)).toBe(expected);
  });
});

describe('weekRange (FE-17, OI-06)', () => {
  test.each([
    ['2026-11-03', '2026-11-02', '2026-11-08'],
    ['2026-11-02', '2026-11-02', '2026-11-08'],
    ['2026-11-08', '2026-11-02', '2026-11-08'],
    ['2027-01-01', '2026-12-28', '2027-01-03'],
    ['2026-01-01', '2025-12-29', '2026-01-04'],
    ['2024-02-29', '2024-02-26', '2024-03-03'],
  ])('OI-06: weekRange(%s) = 월 %s ~ 일 %s', (date, from, to) => {
    expect(weekRange(date)).toEqual({ from, to });
  });

  test('FE-17: 2026-11-03이 속한 주의 시작 11-02, 끝 11-08', () => {
    expect(weekRange('2026-11-03')).toEqual({ from: '2026-11-02', to: '2026-11-08' });
  });
});

describe('firstOfMonth (OI-06)', () => {
  test.each([
    ['2026-11-03', 0, '2026-11-01'],
    ['2026-11-03', 1, '2026-12-01'],
    ['2026-12-15', 1, '2027-01-01'],
    ['2026-01-31', -1, '2025-12-01'],
    ['2026-03-31', -1, '2026-02-01'],
    ['2026-11-03', 12, '2027-11-01'],
    ['2026-11-03', -11, '2025-12-01'],
    ['0001-02-10', -1, '0001-01-01'],
  ])('firstOfMonth(%s, %i) = %s', (date, offset, expected) => {
    expect(firstOfMonth(date, offset)).toBe(expected);
  });

  test('offset 기본값은 0', () => {
    expect(firstOfMonth('2026-11-03')).toBe('2026-11-01');
  });
});

describe('todayIn', () => {
  const now = Date.parse('2026-11-03T20:00:00Z');
  test.each([
    ['Asia/Seoul', '2026-11-04'],
    ['UTC', '2026-11-03'],
    ['Pacific/Kiritimati', '2026-11-04'],
    ['Pacific/Pago_Pago', '2026-11-03'],
  ])('todayIn(%s) = %s', (tz, expected) => {
    expect(todayIn(tz, now)).toBe(expected);
  });
});

describe('formatTimestamp', () => {
  const iso = '2026-11-04T05:10:00.000Z';

  test('CN-07: 같은 시각을 시간대별로 다르게 표시한다', () => {
    const seoul = formatTimestamp(iso, 'Asia/Seoul');
    const utc = formatTimestamp(iso, 'UTC');
    expect(seoul).toBe('2026-11-04 14:10');
    expect(utc).toBe('2026-11-04 05:10');
    expect(seoul).not.toBe(utc);
  });

  test('자정은 24시간 표기 00:00으로 날짜가 넘어간다', () => {
    expect(formatTimestamp('2026-11-04T15:00:00.000Z', 'Asia/Seoul')).toBe('2026-11-05 00:00');
  });
});
