// CN-06: new Date는 src/에서 이 파일에만 둔다
export function getToday(timezone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function toIsoTimestamp(ms) {
  return new Date(ms).toISOString();
}
