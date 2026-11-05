import { useAlertStore } from '../store/alertStore';
import styles from './TopAlert.module.css';

export function TopAlert() {
  const alert = useAlertStore((s) => s.alert);
  const clearAlert = useAlertStore((s) => s.clearAlert);
  if (!alert) return null;
  return (
    <div role="alert" className={`${styles.alert} ${styles[alert.kind]}`}>
      <span>{alert.message}</span>
      <button type="button" className={styles.close} onClick={clearAlert}>
        닫기
      </button>
    </div>
  );
}
