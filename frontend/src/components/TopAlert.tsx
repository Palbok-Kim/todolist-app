import { useAlertStore } from '../store/alertStore';
import { useT } from '../store/prefsStore';
import styles from './TopAlert.module.css';

export function TopAlert() {
  const alert = useAlertStore((s) => s.alert);
  const clearAlert = useAlertStore((s) => s.clearAlert);
  const t = useT();
  if (!alert) return null;
  return (
    <div role="alert" className={`${styles.alert} ${styles[alert.kind]}`}>
      <span>{t(alert.message)}</span>
      <button type="button" className={styles.close} onClick={clearAlert}>
        {t('닫기')}
      </button>
    </div>
  );
}
