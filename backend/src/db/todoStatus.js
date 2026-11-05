// CN-09, 9-design.md D-02
export const TODO_STATUS = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  OVERDUE: 'OVERDUE',
});

// 도메인 4장 판정 순서(완료 → 기한 초과 → 시작 전 → 진행 중). today는 '$n' 바인딩 자리표시자다(DL-09)
export function statusCase(todayParam) {
  return `CASE
    WHEN completed THEN '${TODO_STATUS.COMPLETED}'
    WHEN ${todayParam}::date > end_date THEN '${TODO_STATUS.OVERDUE}'
    WHEN ${todayParam}::date < start_date THEN '${TODO_STATUS.NOT_STARTED}'
    ELSE '${TODO_STATUS.IN_PROGRESS}'
  END`;
}
