import { useEffect } from 'react';
import { FieldError } from '../../components/FieldError';
import { useT } from '../../store/prefsStore';
import { useCategories } from './queries';
import styles from './CategorySelect.module.css';

interface Props {
  id: string;
  value: string;
  onChange: (categoryId: string) => void;
  invalid?: boolean;
}

export function CategorySelect({ id, value, onChange, invalid }: Props) {
  const t = useT();
  const { data, isPending, error } = useCategories();
  const items = data?.items ?? [];
  const def = items.find((c) => c.isDefault);

  // 화면에만 '기본'이 보이고 폼 값이 비면 서버가 400이므로 폼 값을 '기본' id로 채운다(BR-04, PRD 7장)
  useEffect(() => {
    if (!value && def) onChange(def.id);
  }, [value, def, onChange]);

  if (isPending || error) {
    return (
      <>
        <select id={id} className={styles.select} disabled>
          <option>{t(isPending ? '불러오는 중...' : '불러오지 못했습니다')}</option>
        </select>
        {error && <FieldError message={error.message} />}
      </>
    );
  }

  return (
    <select
      id={id}
      className={styles.select}
      value={value}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange(e.target.value)}
    >
      {items.map((c) => (
        <option key={c.id} value={c.id}>
          {c.isDefault ? t(c.name) : c.name}
        </option>
      ))}
    </select>
  );
}
