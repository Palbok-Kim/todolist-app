import styles from './FieldError.module.css';

export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className={styles.error}>{message}</p>;
}
