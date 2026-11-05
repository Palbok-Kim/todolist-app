import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { StatusBadge } from '../../components/StatusBadge';
import { useListFilterStore } from '../../store/todoFilterStore';
import { useCategories } from '../category/queries';
import { ERR, useTodos, type TodoFilter } from './queries';
import { STATUS_LABEL, STATUS_TONE } from './statusLabel';
import styles from './TodoList.module.css';

export function TodoTable() {
  const { categoryId, status, setCatId } = useListFilterStore();
  const navigate = useNavigate();
  const { data, isPending, error } = useTodos({
    categoryId,
    status: status as TodoFilter['status'],
  });
  const categories = useCategories().data?.items ?? [];
  const names = new Map(categories.map((c) => [c.id, c.name]));

  // SC-09 3b: 필터에 쓴 카테고리가 삭제됐으면 필터를 풀어 전체를 다시 보여준다
  const staleCategory = error?.code === ERR.NOT_FOUND && !!categoryId;
  useEffect(() => {
    if (staleCategory) setCatId(null);
  }, [staleCategory, setCatId]);

  if (isPending || staleCategory) return <p className={styles.message}>불러오는 중...</p>;
  if (error) return <p className={styles.message}>{error.message}</p>;

  const todos = data.items;
  if (todos.length === 0) {
    const filtered = !!categoryId || !!status;
    return (
      <div className={styles.message}>
        <p>{filtered ? '조건에 맞는 할일이 없습니다' : '아직 할일이 없습니다'}</p>
        {!filtered && (
          <Link to="/todos/new" className={styles.primary}>
            + 새 할일
          </Link>
        )}
      </div>
    );
  }

  const open = (id: string) => navigate('/todos/' + id);
  const titleClass = (s: (typeof todos)[number]['status']) =>
    STATUS_TONE[s] === 'done' ? `${styles.title} ${styles.done}` : styles.title;

  return (
    <>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>제목</th>
            <th>카테고리</th>
            <th>기간</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {todos.map((t) => (
            <tr key={t.id} onClick={() => open(t.id)}>
              <td className={titleClass(t.status)}>{t.title}</td>
              <td>{names.get(t.categoryId) ?? ''}</td>
              <td className={styles.period}>
                {t.startDate} ~ {t.endDate}
              </td>
              <td>
                <StatusBadge label={STATUS_LABEL[t.status]} tone={STATUS_TONE[t.status]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className={styles.cards}>
        {todos.map((t) => (
          <li key={t.id} className={styles.card} onClick={() => open(t.id)}>
            <div className={styles.cardTop}>
              <span className={titleClass(t.status)}>{t.title}</span>
              <StatusBadge label={STATUS_LABEL[t.status]} tone={STATUS_TONE[t.status]} />
            </div>
            <div className={styles.sub}>
              {names.get(t.categoryId) ?? ''} ·{' '}
              <span className={styles.period}>
                {t.startDate} ~ {t.endDate}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
