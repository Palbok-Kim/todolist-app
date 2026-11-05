import { useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ERR } from '../../api/errorCodes';
import type { FieldIssue, Todo } from '../../api/types';
import { FieldError } from '../../components/FieldError';
import { formatTimestamp } from '../../lib/date';
import { useAlertStore } from '../../store/alertStore';
import { useT } from '../../store/prefsStore';
import { useMe } from '../auth/queries';
import { StatusBadge } from '../../components/StatusBadge';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useCreateTodo, useDeleteTodo, useUpdateTodo } from './queries';
import { STATUS_LABEL, STATUS_TONE } from './statusLabel';
import { validateTodo } from './validation';
import styles from './TodoForm.module.css';

interface Props {
  todo?: Todo;
  renderCategory: (p: {
    id: string;
    value: string;
    onChange: (v: string) => void;
    invalid: boolean;
  }) => ReactNode;
}

export function TodoForm({ todo, renderCategory }: Props) {
  const t = useT();
  // DL-13: 초기값은 한 번만 쓰고 refetch가 입력을 덮지 않게 한다
  const [title, setTitle] = useState(todo?.title ?? '');
  const [description, setDescription] = useState(todo?.description ?? '');
  const [startDate, setStartDate] = useState(todo?.startDate ?? '');
  const [endDate, setEndDate] = useState(todo?.endDate ?? '');
  const [categoryId, setCategoryId] = useState(todo?.categoryId ?? '');
  const [completed, setCompleted] = useState(todo?.completed ?? false);
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const create = useCreateTodo();
  const update = useUpdateTodo();
  const del = useDeleteTodo();
  const [confirming, setConfirming] = useState(false);
  const me = useMe().data;
  const navigate = useNavigate();
  const location = useLocation();
  const { showAlert, clearAlert } = useAlertStore();
  const msg = (field: string) => issues.find((i) => i.field === field)?.message;
  const pending = create.isPending || update.isPending || del.isPending;

  // 직접 URL로 진입했으면 앱 밖으로 나가지 않게 목록으로 보낸다
  const back = () => (location.key === 'default' ? navigate('/todos') : navigate(-1));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    clearAlert();
    const found = validateTodo({ title, description, startDate, endDate });
    setIssues(found);
    if (found.length > 0) return;
    const opts = {
      onSuccess: back,
      // PR-08: code로만 분기, 문구는 서버 message 그대로(CN-08)
      onError: (err: { code: string; message: string; fields?: FieldIssue[] }) => {
        if (err.code === ERR.VALIDATION_ERROR && err.fields) setIssues(err.fields);
        else showAlert('error', err.message);
      },
    };
    if (todo) {
      // 빈 수정 본문은 400이라 전체 필드를 보낸다
      update.mutate(
        { id: todo.id, body: { title, description, startDate, endDate, categoryId, completed } },
        opts,
      );
    } else {
      // BR-04: 값이 비어도 서버가 기본 카테고리를 쓴다
      create.mutate(
        { title, description, startDate, endDate, categoryId: categoryId || null },
        opts,
      );
    }
  };

  const tone = todo ? STATUS_TONE[todo.status] : null;

  return (
    <form noValidate className={styles.form} onSubmit={onSubmit}>
      <div className={styles.header}>
        <button type="button" className={styles.textBtn} onClick={back}>
          &lt; {t('뒤로')}
        </button>
        <h1>{t(todo ? '할일 편집' : '할일 등록')}</h1>
      </div>
      <div className={styles.row}>
        <label htmlFor="todo-title">
          {t('제목')}
          <span className={styles.req}>*</span>
        </label>
        <div>
          <input
            id="todo-title"
            type="text"
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={!!msg('title')}
          />
          <FieldError message={msg('title')} />
        </div>
      </div>
      <div className={styles.row}>
        <label htmlFor="todo-description">{t('설명')}</label>
        <div>
          <textarea
            id="todo-description"
            rows={3}
            className={styles.input}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-invalid={!!msg('description')}
          />
          <FieldError message={msg('description')} />
        </div>
      </div>
      <div className={styles.row}>
        <label htmlFor="todo-category">{t('카테고리')}</label>
        <div>
          {renderCategory({
            id: 'todo-category',
            value: categoryId,
            onChange: setCategoryId,
            invalid: !!msg('categoryId'),
          })}
          <FieldError message={msg('categoryId')} />
        </div>
      </div>
      <div className={styles.row}>
        <label htmlFor="todo-startDate">
          {t('시작일')}
          <span className={styles.req}>*</span>
        </label>
        <div>
          <input
            id="todo-startDate"
            type="date"
            className={`${styles.input} ${styles.date}`}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-invalid={!!msg('startDate')}
          />
          <FieldError message={msg('startDate')} />
        </div>
      </div>
      <div className={styles.row}>
        <label htmlFor="todo-endDate">
          {t('종료일')}
          <span className={styles.req}>*</span>
        </label>
        <div>
          <input
            id="todo-endDate"
            type="date"
            className={`${styles.input} ${styles.date}`}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-invalid={!!msg('endDate')}
          />
          <FieldError message={msg('endDate')} />
        </div>
      </div>
      {todo && tone && (
        <>
          <div className={styles.row}>
            <span className={styles.label}>{t('상태')}</span>
            <div className={styles.completeLine}>
              <input
                id="todo-completed"
                type="checkbox"
                checked={completed}
                onChange={(e) => setCompleted(e.target.checked)}
              />
              <label htmlFor="todo-completed">{t('완료로 표시')}</label>
              <StatusBadge label={STATUS_LABEL[todo.status]} tone={tone} />
            </div>
          </div>
          {me && (
            <div className={styles.row}>
              <span />
              <p className={styles.muted}>
                {t('마지막 수정')} {formatTimestamp(todo.updatedAt, me.timezone)}
              </p>
            </div>
          )}
        </>
      )}
      <div className={styles.actions}>
        {todo && (
          <button
            type="button"
            className={styles.danger}
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            {t('삭제')}
          </button>
        )}
        <button type="button" className={styles.secondary} onClick={back}>
          {t('취소')}
        </button>
        <button type="submit" className={styles.primary} disabled={pending}>
          {pending ? t('저장 중...') : t('저장')}
        </button>
      </div>
      {todo && confirming && (
        <ConfirmDialog
          title={t('할일을 삭제할까요?')}
          message={t('삭제하면 복구할 수 없습니다.')}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            clearAlert();
            del.mutate(todo.id, { onSuccess: back, onError: (e) => showAlert('error', e.message) });
          }}
        />
      )}
    </form>
  );
}
