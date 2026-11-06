import { isRouteErrorResponse, useRouteError } from 'react-router';
import { devLog } from '../lib/logger';
import { useT } from '../store/prefsStore';
import styles from './ErrorPage.module.css';

// WF 3.2 오류 화면: 없는 주소(404)와 예기치 못한 렌더링 오류. 세부는 화면에 넣지 않는다(SO-06)
export function ErrorPage() {
  const error = useRouteError();
  const t = useT();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  if (!notFound) devLog('render error', { error: String(error) }, 'error');
  return (
    <div className={styles.page}>
      <div className={styles.box} role="alert">
        <p className={styles.brand}>TodoList</p>
        <p className={styles.message}>
          {notFound
            ? t('페이지를 찾을 수 없습니다')
            : t('문제가 발생했습니다. 잠시 후 다시 시도하세요.')}
        </p>
        <div className={styles.actions}>
          {/* 깨진 화면 상태를 버리도록 페이지를 새로 불러온다 */}
          <a className={styles.primary} href="/todos">
            {t('목록으로')}
          </a>
          {!notFound && (
            <button type="button" className={styles.secondary} onClick={() => location.reload()}>
              {t('새로고침')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
