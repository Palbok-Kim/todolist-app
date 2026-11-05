import { useT } from '../store/prefsStore';
import styles from './StatusBadge.module.css';

// 도메인을 모르는 배지: 라벨과 색 이름만 받는다(style-guide 4.4, 상태 색 2.1)
export type StatusTone = 'todo' | 'doing' | 'done' | 'overdue';

export function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  const t = useT();
  return (
    <span
      className={styles.badge}
      style={{ background: `var(--status-${tone}-soft)`, color: `var(--status-${tone})` }}
    >
      {t(label)}
    </span>
  );
}
