import { useState, type FormEvent } from 'react';
import { ERR } from '../../api/errorCodes';
import type { ApiError } from '../../api/client';
import type { CategoryWithTodoCount } from '../../api/types';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FieldError } from '../../components/FieldError';
import { useAlertStore } from '../../store/alertStore';
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from './queries';
import { validateCategoryName } from './validation';
import styles from './CategoryManager.module.css';

// WF-08: 이름 문제(400·409)는 입력란 아래, 그 밖은 상단 알림
function nameIssue(e: ApiError): string | null {
  if (e.code !== ERR.VALIDATION_ERROR && e.code !== ERR.CONFLICT) return null;
  return e.fields?.find((f) => f.field === 'name')?.message ?? null;
}

export function CategoryManager() {
  const { data, isPending, error } = useCategories();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const del = useDeleteCategory();
  const { showAlert, clearAlert } = useAlertStore();

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CategoryWithTodoCount | null>(null);

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    clearAlert();
    const err = validateCategoryName(name);
    setNameError(err);
    if (err) return;
    create.mutate(name.trim(), {
      onSuccess: () => setName(''),
      onError: (e2) => {
        const m = nameIssue(e2);
        if (m) setNameError(m);
        else showAlert('error', e2.message);
      },
    });
  };

  const startEdit = (c: CategoryWithTodoCount) => {
    clearAlert();
    setEditingId(c.id);
    setEditName(c.name);
    setEditError(null);
  };

  const onRename = (e: FormEvent, id: string) => {
    e.preventDefault();
    clearAlert();
    const err = validateCategoryName(editName);
    setEditError(err);
    if (err) return;
    update.mutate(
      { id, name: editName.trim() },
      {
        onSuccess: () => setEditingId(null),
        onError: (e2) => {
          const m = nameIssue(e2);
          if (m) setEditError(m);
          else showAlert('error', e2.message);
        },
      },
    );
  };

  const onDelete = (c: CategoryWithTodoCount) => {
    setDeleting(null);
    clearAlert();
    del.mutate(c.id, { onError: (e) => showAlert('error', e.message) });
  };

  return (
    <div>
      <form className={styles.createRow} onSubmit={onCreate} noValidate>
        <label htmlFor="new-category">새 카테고리</label>
        <input
          id="new-category"
          className={styles.input}
          value={name}
          aria-invalid={!!nameError}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className={styles.primary} disabled={create.isPending}>
          추가
        </button>
        <div className={styles.errorCell}>
          <FieldError message={nameError} />
        </div>
      </form>

      {isPending && <p className={styles.muted}>불러오는 중...</p>}
      {error && <p className={styles.muted}>{error.message}</p>}
      {data && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>이름</th>
              <th>할일 수</th>
              <th>동작</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((c) => (
              <tr key={c.id}>
                <td data-label="이름">
                  {editingId === c.id ? (
                    <form
                      className={styles.editForm}
                      onSubmit={(e) => onRename(e, c.id)}
                      noValidate
                    >
                      <input
                        className={styles.input}
                        aria-label="카테고리 이름"
                        value={editName}
                        aria-invalid={!!editError}
                        autoFocus
                        onChange={(e) => setEditName(e.target.value)}
                      />
                      <FieldError message={editError} />
                      <div className={styles.btns}>
                        <button
                          type="submit"
                          className={styles.primary}
                          disabled={update.isPending}
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          className={styles.secondary}
                          onClick={() => setEditingId(null)}
                        >
                          취소
                        </button>
                      </div>
                    </form>
                  ) : (
                    c.name
                  )}
                </td>
                <td data-label="할일 수" className={styles.count}>
                  {c.todoCount}
                </td>
                <td data-label="동작">
                  {c.isDefault ? (
                    <span className={styles.muted}>기본 카테고리: 이름 변경·삭제 불가</span>
                  ) : (
                    editingId !== c.id && (
                      <div className={styles.btns}>
                        <button
                          type="button"
                          className={styles.secondary}
                          onClick={() => startEdit(c)}
                        >
                          이름 변경
                        </button>
                        <button
                          type="button"
                          className={styles.secondary}
                          onClick={() => setDeleting(c)}
                        >
                          삭제
                        </button>
                      </div>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {deleting && (
        <ConfirmDialog
          title={`'${deleting.name}' 카테고리를 삭제할까요?`}
          message={`이 카테고리의 할일 ${deleting.todoCount}개가 '기본' 카테고리로 옮겨집니다.`}
          onCancel={() => setDeleting(null)}
          onConfirm={() => onDelete(deleting)}
        />
      )}
    </div>
  );
}
