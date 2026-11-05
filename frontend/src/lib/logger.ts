// SO-06: 프런트 콘솔 로그는 이 파일 하나로만 남기고 개발 모드에서만 출력한다.
// 운영 빌드는 import.meta.env.DEV가 false로 바뀌어 출력 코드가 빠진다. body·비밀번호·토큰은 넘기지 않는다
type Level = 'info' | 'warn' | 'error';

export function devLog(event: string, data?: Record<string, unknown>, level: Level = 'info'): void {
  if (!import.meta.env.DEV) return;
  console[level](`[todolist] ${event}`, data ?? '');
}
