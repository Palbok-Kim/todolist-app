// NFR-10: IP·계정별 로그인 실패 카운터(고정 창)
// LIMIT: 프로세스 메모리라 재시작 시 초기화되고 다중 인스턴스에서 공유되지 않는다(CN-10)
export const WINDOW_MS = 15 * 60 * 1000;
export const IP_LIMIT = 10;
export const EMAIL_LIMIT = 5;
// AQ-10
export const MAX_KEYS = 10_000;

const ips = new Map();
const emails = new Map();

const expired = (e, now, windowMs) => now - e.start >= windowMs;

function current(map, key, now, windowMs) {
  const e = map.get(key);
  if (e && expired(e, now, windowMs)) {
    map.delete(key);
    return undefined;
  }
  return e;
}

export function isLimited({ ip, email }, now = Date.now(), windowMs = WINDOW_MS) {
  const i = ip === undefined ? undefined : current(ips, ip, now, windowMs);
  const e = email === undefined ? undefined : current(emails, email, now, windowMs);
  return (i?.count ?? 0) >= IP_LIMIT || (e?.count ?? 0) >= EMAIL_LIMIT;
}

// 한도에 이미 도달한 항목은 늘리지 않는다(제한 중 시도 미집계)
function bump(map, key, limit, now, windowMs) {
  if (key === undefined) return 0;
  const e = current(map, key, now, windowMs);
  if (e) {
    if (e.count < limit) e.count += 1;
    return e.count;
  }
  if (map.size >= MAX_KEYS) map.delete(map.keys().next().value);
  map.set(key, { count: 1, start: now });
  return 1;
}

export function recordFailure({ ip, email }, now = Date.now(), windowMs = WINDOW_MS) {
  return {
    ip: bump(ips, ip, IP_LIMIT, now, windowMs),
    email: bump(emails, email, EMAIL_LIMIT, now, windowMs),
  };
}

export function sweep(now = Date.now(), windowMs = WINDOW_MS) {
  for (const map of [ips, emails]) {
    for (const [k, e] of map) if (expired(e, now, windowMs)) map.delete(k);
  }
}

export function reset() {
  ips.clear();
  emails.clear();
}

export function size() {
  return { ip: ips.size, email: emails.size };
}

setInterval(() => sweep(), WINDOW_MS).unref();
