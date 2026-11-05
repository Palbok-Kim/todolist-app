import { useState, type FormEvent } from 'react';
import type { FieldIssue, User } from '../../api/types';
import { FieldError } from '../../components/FieldError';
import { useAlertStore } from '../../store/alertStore';
import { ERR, useUpdateMe } from './queries';
import styles from './Settings.module.css';

const zones = Intl.supportedValuesOf('timeZone');

// FR-03: 시간대는 PATCH /users/me의 timezone으로 저장한다
export function TimezoneForm({ user }: { user: User }) {
  const [timezone, setTimezone] = useState(user.timezone);
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const update = useUpdateMe();
  const { showAlert, clearAlert } = useAlertStore();
  // PQ-06: 저장된 값이 목록에 없어도 선택지에 남긴다
  const options = zones.includes(user.timezone) ? zones : [user.timezone, ...zones];
  const msg = issues.find((i) => i.field === 'timezone')?.message;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    clearAlert();
    setIssues([]);
    update.mutate(
      { timezone },
      {
        onSuccess: () => showAlert('info', '시간대를 저장했습니다.'),
        onError: (err) => {
          if (err.code === ERR.VALIDATION_ERROR && err.fields) setIssues(err.fields);
          else showAlert('error', err.message);
        },
      },
    );
  };

  return (
    <form noValidate className={styles.section} onSubmit={onSubmit}>
      <h2 className={styles.title}>시간대</h2>
      <div className={styles.row}>
        <label htmlFor="settings-timezone">시간대</label>
        <div>
          <select
            id="settings-timezone"
            className={styles.input}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            aria-invalid={!!msg}
          >
            {options.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
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
