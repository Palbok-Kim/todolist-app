import { ERR, type ErrorCode } from './errorCodes';
import type { FieldIssue } from './types';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';
const DEFAULT_MESSAGE = '문제가 발생했습니다. 잠시 후 다시 시도하세요.';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class ApiError extends Error {
  status: number;
  code: ErrorCode;
  fields?: FieldIssue[];

  constructor(status: number, code: ErrorCode, message: string, fields?: FieldIssue[]) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

let onUnauthorized: () => void = () => {};
export function setOnUnauthorized(cb: () => void): void {
  onUnauthorized = cb;
}

// 재전송 때 새 쿠키 값이 실리도록 보내는 순간마다 읽는다(DL-14)
function readCsrfToken(): string | undefined {
  const hit = document.cookie.split('; ').find((c) => c.startsWith('csrf_token='));
  return hit?.slice('csrf_token='.length);
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;
  if (res.ok) return data as T;
  const e = data?.error;
  if (e && typeof e.code === 'string') {
    throw new ApiError(
      res.status,
      e.code as ErrorCode,
      String(e.message ?? DEFAULT_MESSAGE),
      e.fields,
    );
  }
  throw new ApiError(res.status, ERR.INTERNAL_ERROR, DEFAULT_MESSAGE);
}

async function send<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') {
    const token = readCsrfToken();
    if (token) headers['X-CSRF-Token'] = token;
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, ERR.INTERNAL_ERROR, DEFAULT_MESSAGE);
  }
  return parse<T>(res);
}

// DL-14: 동시에 ERR-02를 받은 요청은 갱신 하나를 공유한다(single-flight)
let refreshing: Promise<void> | null = null;
function refresh(): Promise<void> {
  refreshing ??= send('POST', '/auth/refresh')
    .then(
      () => {},
      () => {},
    )
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function apiRequest<T>(method: Method, path: string, body?: unknown): Promise<T> {
  try {
    return await send<T>(method, path, body);
  } catch (err) {
    // PR-08: 상태 코드가 아니라 code로만 판단
    if (path.startsWith('/auth/') || !(err instanceof ApiError) || err.code !== ERR.UNAUTHORIZED) {
      throw err;
    }
  }
  // 갱신이 실패해도 다른 탭이 받은 새 쿠키가 있을 수 있어 원 요청을 한 번 재전송한다(DL-14)
  await refresh();
  try {
    return await send<T>(method, path, body);
  } catch (err) {
    if (err instanceof ApiError && err.code === ERR.UNAUTHORIZED) onUnauthorized();
    throw err;
  }
}
