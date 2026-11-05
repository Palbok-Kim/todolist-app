import { useCategories } from '../category/queries';
import { useT } from '../../store/prefsStore';
import { useListFilterStore } from '../../store/todoFilterStore';
import { STATUS_LABEL } from './statusLabel';
import styles from './TodoList.module.css';

// WF-03: 선택 즉시 적용하고 빈 값('전체')은 null로 저장한다
export function TodoFilterBar() {
  const t = useT();
  const { categoryId, status, setCatId, setStatus, resetFilter } = useListFilterStore();
  const categories = useCategories().data?.items ?? [];

  return (
    <div className={styles.filters}>
      <select
        aria-label={t('카테고리')}
        className={styles.select}
        value={categoryId ?? ''}
        onChange={(e) => setCatId(e.target.value || null)}
      >
        <option value="">{t('전체 카테고리')}</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.isDefault ? t(c.name) : c.name}
          </option>
        ))}
      </select>
      <select
        aria-label={t('상태')}
        className={styles.select}
        value={status ?? ''}
        onChange={(e) => setStatus(e.target.value || null)}
      >
        <option value="">{t('전체 상태')}</option>
        {Object.entries(STATUS_LABEL).map(([k, label]) => (
          <option key={k} value={k}>
            {t(label)}
          </option>
        ))}
      </select>
      <button type="button" className={styles.secondary} onClick={resetFilter}>
        {t('필터 해제')}
      </button>
    </div>
  );
}
