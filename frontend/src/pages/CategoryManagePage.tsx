import { Link } from 'react-router';
import { CategoryManager } from '../features/category/CategoryManager';
import { useT } from '../store/prefsStore';
import styles from '../features/category/CategoryManager.module.css';

// WF-08
export function CategoryManagePage() {
  const t = useT();
  return (
    <div className={styles.page}>
      <Link to="/settings" className={styles.back}>
        &lt; {t('설정')}
      </Link>
      <h1 className={styles.title}>{t('카테고리 관리')}</h1>
      <CategoryManager />
    </div>
  );
}
