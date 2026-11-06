import { useState, type FormEvent } from 'react';
import { FieldError } from '../../components/FieldError';
import { useCalendarStore } from '../../store/calendarStore';
import { useT } from '../../store/prefsStore';
import { useCategories, useCreateCategory } from './queries';
import { validateCategoryName } from './validation';
import styles from './CategorySidebar.module.css';

// FR-11, PRD 4.6: 체크 해제한 카테고리의 할일은 캘린더에서 숨기고, 아래 입력란으로 카테고리를 만든다
export function CategorySidebar() {
  const t = useT();
  const { data } = useCategories();
  const create = useCreateCategory();
  const hidden = useCalendarStore((s) => s.hiddenCategoryIds);
  const toggle = useCalendarStore((s) => s.toggleCategory);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    const err = validateCategoryName(name);
    setError(err);
    if (err) return;
    create.mutate(name.trim(), {
      onSuccess: () => setName(''),
      onError: (e2) => setError(e2.fields?.find((f) => f.field === 'name')?.message ?? e2.message),
    });
  };

  return (
    <aside className={styles.side}>
      <h2 className={styles.title}>{t('카테고리')}</h2>
      <ul className={styles.list}>
        {data?.items.map((c) => (
          <li key={c.id}>
            <label className={hidden.includes(c.id) ? styles.off : styles.item}>
              <input
                type="checkbox"
                checked={!hidden.includes(c.id)}
                onChange={() => toggle(c.id)}
              />
              {c.isDefault ? t(c.name) : c.name}
            </label>
          </li>
        ))}
      </ul>
      <form className={styles.form} onSubmit={onCreate} noValidate>
        <input
          className={styles.input}
          aria-label={t('새 카테고리')}
          placeholder={t('새 카테고리')}
          value={name}
          aria-invalid={!!error}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className={styles.add} disabled={create.isPending}>
          {t('추가')}
        </button>
      </form>
      <FieldError message={error} />
    </aside>
  );
}
