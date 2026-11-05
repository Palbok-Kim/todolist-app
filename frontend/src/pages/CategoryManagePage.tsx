import { Link } from 'react-router';
import { CategoryManager } from '../features/category/CategoryManager';
import styles from '../features/category/CategoryManager.module.css';

// WF-08
export function CategoryManagePage() {
  return (
    <div className={styles.page}>
      <Link to="/settings" className={styles.back}>
        &lt; 설정
      </Link>
      <h1 className={styles.title}>카테고리 관리</h1>
      <CategoryManager />
    </div>
  );
}
