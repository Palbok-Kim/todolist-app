// CN-06: new Date는 프런트에서 이 파일에만 둔다
// Date.UTC는 0~99년을 1900년대로 바꾸므로 setUTCFullYear를 쓴다
function utc(date: string, days = 0): Date {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(0);
  dt.setUTCFullYear(y, m - 1, d + days);
  return dt;
}

export function addDays(date: string, days: number): string {
  const dt = utc(date, days);
  const y = String(dt.getUTCFullYear()).padStart(4, '0');
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 월요일 시작(OI-06): 월=0 … 일=6
export function weekdayIndex(date: string): number {
  return (utc(date).getUTCDay() + 6) % 7;
}

// 월요일 시작(OI-06)이라 주의 끝은 시작 + 6일
export function weekRange(date: string): { from: string; to: string } {
  const from = addDays(date, -weekdayIndex(date));
  return { from, to: addDays(from, 6) };
}

// 정수 산술로 월을 옮겨 31일 같은 일자 넘침을 피한다
export function firstOfMonth(date: string, offset = 0): string {
  const [y, m] = date.split('-').map(Number);
  const t = y * 12 + (m - 1) + offset;
  const yy = String(Math.floor(t / 12)).padStart(4, '0');
  const mm = String((t % 12) + 1).padStart(2, '0');
  return `${yy}-${mm}-01`;
}

// CN-12: 요일 이름(월요일 시작, OI-06)은 언어별로 Intl이 만든다. 2024-01-01은 월요일
export function weekdayNames(lang: string): string[] {
  const f = new Intl.DateTimeFormat(lang, { weekday: 'short', timeZone: 'UTC' });
  return Array.from({ length: 7 }, (_, i) => f.format(utc('2024-01-01', i)));
}

function format(timeZone: string, ms: number, opts: Intl.DateTimeFormatOptions) {
  const ps = new Intl.DateTimeFormat('en-CA', { timeZone, ...opts }).formatToParts(new Date(ms));
  return (type: string) => ps.find((p) => p.type === type)!.value;
}

export function todayIn(timezone: string, nowMs: number = Date.now()): string {
  const get = format(timezone, nowMs, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// CN-07: UTC 시각을 사용자 timezone으로 표시. h23은 24:00 표기를 막는다
export function formatTimestamp(iso: string, timezone: string): string {
  const get = format(timezone, Date.parse(iso), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}
