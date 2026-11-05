import { useT } from '../store/prefsStore';
import styles from './FieldError.module.css';

export function FieldError({ message }: { message?: string | null }) {
  const t = useT();
  if (!message) return null;
  return <p className={styles.error}>{t(message)}</p>;
}
