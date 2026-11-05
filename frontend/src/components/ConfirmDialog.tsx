import { useT } from '../store/prefsStore';
import styles from './ConfirmDialog.module.css';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// 부모가 조건부 렌더한다. 바탕 클릭으로는 닫지 않는다(실수 방지, WF 3.2).
// title·message는 사용자 입력이 섞일 수 있어 부모가 번역해 넘긴다. confirmLabel만 한국어 원문(CN-12)
export function ConfirmDialog({
  title,
  message,
  confirmLabel = '삭제',
  onConfirm,
  onCancel,
}: Props) {
  const t = useT();
  return (
    <div className={styles.backdrop}>
      <div role="dialog" aria-modal="true" aria-label={title} className={styles.box}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onCancel}>
            {t('취소')}
          </button>
          <button type="button" className={styles.confirm} onClick={onConfirm}>
            {t(confirmLabel)}
          </button>
        </div>
      </div>
    </div>
  );
}
