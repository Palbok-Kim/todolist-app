import { useCategories } from '../category/queries';
import { useListFilterStore } from '../../store/todoFilterStore';
import { STATUS_LABEL } from './statusLabel';
import styles from './TodoList.module.css';

// WF-03: 선택 즉시 적용하고 빈 값('전체')은 null로 저장한다
export function TodoFilterBar() {
  const { categoryId, status, setCatId, setStatus, resetFilter } = useListFilterStore();
  const categories = useCategories().data?.items ?? [];

  return (
    <div className={styles.filters}>
      <select
        aria-label="카테고리"
        className={styles.select}
        value={categoryId ?? ''}
        onChange={(e) => setCatId(e.target.value || null)}
      >
        <option value="">전체 카테고리</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        aria-label="상태"
        className={styles.select}
        value={status ?? ''}
        onChange={(e) => setStatus(e.target.value || null)}
      >
        <option value="">전체 상태</option>
        {Object.entries(STATUS_LABEL).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
      <button type="button" className={styles.secondary} onClick={resetFilter}>
        필터 해제
      </button>
    </div>
  );
}
