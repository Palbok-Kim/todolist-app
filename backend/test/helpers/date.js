// TQ-03: 'YYYY-MM-DD'를 UTC 기준으로 n일 이동한다
export function shiftDate(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
