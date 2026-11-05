import { Link } from 'react-router';
import { useMe } from '../features/auth/queries';
import { PasswordForm } from '../features/user/PasswordForm';
import { ProfileForm } from '../features/user/ProfileForm';
import { TimezoneForm } from '../features/user/TimezoneForm';
import styles from '../features/user/Settings.module.css';

// WF-07
export function SettingsPage() {
  const { data: user } = useMe();
  if (!user) return <p>불러오는 중...</p>;
  return (
    <div className={styles.page}>
      <h1>설정</h1>
      <TimezoneForm user={user} />
      <ProfileForm user={user} />
      <PasswordForm />
      <section className={styles.section}>
        <h2 className={styles.title}>카테고리 (P1)</h2>
        <Link to="/settings/categories" className={styles.link}>
          카테고리 관리 ›
        </Link>
      </section>
    </div>
  );
}
