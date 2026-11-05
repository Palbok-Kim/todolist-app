import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ERR } from '../../api/errorCodes';
import type { FieldIssue } from '../../api/types';
import { FieldError } from '../../components/FieldError';
import { useAlertStore } from '../../store/alertStore';
import { useT } from '../../store/prefsStore';
import { useLogin } from './queries';
import { validateLogin } from './validation';
import styles from './AuthForm.module.css';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const t = useT();
  const login = useLogin();
  const navigate = useNavigate();
  const { showAlert, clearAlert } = useAlertStore();
  const msg = (field: string) => issues.find((i) => i.field === field)?.message;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    clearAlert();
    const found = validateLogin({ email, password });
    setIssues(found);
    if (found.length > 0) return;
    login.mutate(
      { email, password },
      {
        onSuccess: () => navigate('/todos', { replace: true }),
        // PR-08: code로만 분기, 문구는 서버 message 그대로(CN-08)
        onError: (err) => {
          if ((err.code === ERR.VALIDATION_ERROR || err.code === ERR.CONFLICT) && err.fields)
            setIssues(err.fields);
          else showAlert('error', err.message);
        },
      },
    );
  };

  return (
    <form noValidate className={styles.form} onSubmit={onSubmit}>
      <h1 className={styles.title}>{t('로그인')}</h1>
      <div className={styles.field}>
        <label htmlFor="login-email">{t('이메일')}</label>
        <input
          id="login-email"
          type="email"
          autoComplete="username"
          className={styles.input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!msg('email')}
        />
        <FieldError message={msg('email')} />
      </div>
      <div className={styles.field}>
        <label htmlFor="login-password">{t('비밀번호')}</label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          className={styles.input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!msg('password')}
        />
        <FieldError message={msg('password')} />
      </div>
      <button type="submit" className={styles.submit} disabled={login.isPending}>
        {login.isPending ? t('로그인 중...') : t('로그인')}
      </button>
      <p className={styles.footer}>
        {t('계정이 없나요?')}{' '}
        <Link to="/signup" onClick={clearAlert}>
          {t('회원가입')}
        </Link>
      </p>
    </form>
  );
}
