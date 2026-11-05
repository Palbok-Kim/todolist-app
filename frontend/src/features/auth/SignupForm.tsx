import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ERR } from '../../api/errorCodes';
import type { FieldIssue } from '../../api/types';
import { FieldError } from '../../components/FieldError';
import { useAlertStore } from '../../store/alertStore';
import { useSignup } from './queries';
import { validateSignup } from './validation';
import styles from './AuthForm.module.css';

export function SignupForm() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const signup = useSignup();
  const navigate = useNavigate();
  const { showAlert, clearAlert } = useAlertStore();
  const msg = (field: string) => issues.find((i) => i.field === field)?.message;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    clearAlert();
    const found = validateSignup({ email, password, name });
    setIssues(found);
    if (found.length > 0) return;
    signup.mutate(
      { email, password, name, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }, // PRD 4.2
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
      <h1 className={styles.title}>회원가입</h1>
      <div className={styles.field}>
        <label htmlFor="signup-email">이메일</label>
        <input
          id="signup-email"
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
        <label htmlFor="signup-name">이름</label>
        <input
          id="signup-name"
          type="text"
          autoComplete="name"
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!msg('name')}
        />
        <FieldError message={msg('name')} />
      </div>
      <div className={styles.field}>
        <label htmlFor="signup-password">비밀번호</label>
        <input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          className={styles.input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!msg('password')}
        />
        <p className={styles.hint}>
          영대문자·영소문자·숫자·특수문자 중 3종류 이상 8자, 또는 2종류 이상 10자 이상
        </p>
        <FieldError message={msg('password')} />
      </div>
      <button type="submit" className={styles.submit} disabled={signup.isPending}>
        {signup.isPending ? '가입 중...' : '가입하기'}
      </button>
      <p className={styles.footer}>
        이미 계정이 있나요?{' '}
        <Link to="/login" onClick={clearAlert}>
          로그인
        </Link>
      </p>
    </form>
  );
}
