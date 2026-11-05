import { useState, type FormEvent } from 'react';
import type { FieldIssue, User } from '../../api/types';
import { FieldError } from '../../components/FieldError';
import { textError } from '../../lib/validation';
import { useAlertStore } from '../../store/alertStore';
import { ERR, useUpdateMe } from './queries';
import styles from './Settings.module.css';

export function ProfileForm({ user }: { user: User }) {
  const [name, setName] = useState(user.name);
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const update = useUpdateMe();
  const { showAlert, clearAlert } = useAlertStore();
  const msg = issues.find((i) => i.field === 'name')?.message;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    clearAlert();
    // VR-03: 서버와 같은 검증을 먼저 통과해야 보낸다
    const local = textError(name, 50);
    setIssues(local ? [{ field: 'name', message: local }] : []);
    if (local) return;
    update.mutate(
      { name },
      {
        onSuccess: () => showAlert('info', '이름을 저장했습니다.'),
        onError: (err) => {
          if (err.code === ERR.VALIDATION_ERROR && err.fields) setIssues(err.fields);
          else showAlert('error', err.message);
        },
      },
    );
  };

  return (
    <form noValidate className={styles.section} onSubmit={onSubmit}>
      <h2 className={styles.title}>내 정보</h2>
      <div className={styles.row}>
        <span className={styles.label}>이메일</span>
        <p className={styles.text}>{user.email}</p>
      </div>
      <div className={styles.row}>
        <label htmlFor="settings-name">이름</label>
        <div>
          <input
            id="settings-name"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!msg}
          />
          <FieldError message={msg} />
        </div>
      </div>
      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={update.isPending}>
          저장
        </button>
      </div>
    </form>
  );
}
