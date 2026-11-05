import { useState, type FormEvent } from 'react';
import type { FieldIssue } from '../../api/types';
import { FieldError } from '../../components/FieldError';
import { useAlertStore } from '../../store/alertStore';
import { useT } from '../../store/prefsStore';
import { ERR, useChangePassword } from './queries';
import styles from './Settings.module.css';

// VR-02는 서버만 판정한다(복제 방지). 비밀번호는 trim하지 않는다
export function PasswordForm() {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const t = useT();
  const change = useChangePassword();
  const { showAlert, clearAlert } = useAlertStore();
  const msg = (field: string) => issues.find((i) => i.field === field)?.message;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    clearAlert();
    setIssues([]);
    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrent('');
          setNew('');
          showAlert('info', '비밀번호를 변경했습니다.');
        },
        onError: (err) => {
          if (err.code === ERR.VALIDATION_ERROR && err.fields) setIssues(err.fields);
          else showAlert('error', err.message);
        },
      },
    );
  };

  return (
    <form noValidate className={styles.section} onSubmit={onSubmit}>
      <h2 className={styles.title}>{t('비밀번호 변경')}</h2>
      <div className={styles.row}>
        <label htmlFor="settings-current-password">{t('현재 비밀번호')}</label>
        <div>
          <input
            id="settings-current-password"
            type="password"
            autoComplete="current-password"
            className={styles.input}
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
            aria-invalid={!!msg('currentPassword')}
          />
          <FieldError message={msg('currentPassword')} />
        </div>
      </div>
      <div className={styles.row}>
        <label htmlFor="settings-new-password">{t('새 비밀번호')}</label>
        <div>
          <input
            id="settings-new-password"
            type="password"
            autoComplete="new-password"
            className={styles.input}
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
            aria-invalid={!!msg('newPassword')}
          />
          <FieldError message={msg('newPassword')} />
        </div>
      </div>
      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={change.isPending}>
          {t('변경')}
        </button>
      </div>
    </form>
  );
}
