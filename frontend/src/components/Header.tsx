import { useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { useMenuStore } from '../store/menuStore';
import styles from './Header.module.css';

interface Props {
  onLogout?: () => void;
  logoutPending?: boolean;
  userName?: string;
}

const tabs = [
  { to: '/todos', label: '목록' },
  { to: '/calendar', label: '캘린더' },
  { to: '/settings', label: '설정' },
];

// onLogout이 없으면 로고만 보인다(공개 화면, WF 3.1)
export function Header({ onLogout, logoutPending, userName }: Props) {
  const open = useMenuStore((s) => s.open);
  const toggleMenu = useMenuStore((s) => s.toggleMenu);
  const closeMenu = useMenuStore((s) => s.closeMenu);
  const { pathname } = useLocation();

  // 경로가 바뀌면 모바일 메뉴를 닫는다(WF 3.1)
  useEffect(() => closeMenu(), [pathname, closeMenu]);

  return (
    <header className={styles.header}>
      {onLogout && (
        <button
          type="button"
          className={styles.menuBtn}
          aria-expanded={open}
          aria-label="메뉴"
          onClick={toggleMenu}
        >
          =
        </button>
      )}
      <Link to="/todos" className={styles.logo}>
        TodoList
      </Link>
      {onLogout && (
        <>
          <nav className={open ? styles.navOpen : styles.nav} onClick={closeMenu}>
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
                }
              >
                {t.label}
              </NavLink>
            ))}
            {/* AC-19: 이름 변경이 헤더에 바로 보인다 */}
            <span className={styles.user}>{userName}</span>
            <button
              type="button"
              className={styles.logout}
              disabled={logoutPending}
              onClick={onLogout}
            >
              로그아웃
            </button>
          </nav>
          {/* inline-flex 항목 맨 앞 공백은 사라지므로 줄바꿈 없는 공백을 쓴다 */}
          <Link to="/todos/new" className={styles.newBtn}>
            + 새<span className={styles.wide}>&nbsp;할일</span>
          </Link>
        </>
      )}
    </header>
  );
}
