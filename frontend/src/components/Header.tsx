import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { useCalendarStore } from '../store/calendarStore';
import { useMenuStore } from '../store/menuStore';
import { useT } from '../store/prefsStore';
import styles from './Header.module.css';

interface Props {
  onLogout?: () => void;
  logoutPending?: boolean;
  user?: { name: string; email: string };
}

// 언어가 달라도 설정임을 알아보게 기어 기호를 붙인다(WF 3.1, 스타일 가이드 8장)
function GearIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const tabs = [
  { to: '/calendar', label: '캘린더' },
  { to: '/todos', label: '목록' },
];

// onLogout이 없으면 로고만 보인다(공개 화면, WF 3.1). 탭은 캘린더·목록, 맨 오른쪽 프로필 팝업에 로그아웃
export function Header({ onLogout, logoutPending, user }: Props) {
  const open = useMenuStore((s) => s.open);
  const toggleMenu = useMenuStore((s) => s.toggleMenu);
  const closeMenu = useMenuStore((s) => s.closeMenu);
  const { pathname } = useLocation();
  const t = useT();
  // 연 경로를 기억해 경로가 바뀌면 팝업이 저절로 닫힌다(WF 3.1)
  const [openAt, setOpenAt] = useState<string | null>(null);
  const profileOpen = openAt === pathname;
  const profileRef = useRef<HTMLDivElement>(null);

  // 경로가 바뀌면 모바일 메뉴를 닫는다(WF 3.1)
  useEffect(() => closeMenu(), [pathname, closeMenu]);

  // WF 3.1: 팝업 밖을 누르거나 Esc면 닫는다
  useEffect(() => {
    if (!profileOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!profileRef.current?.contains(e.target as Node)) setOpenAt(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenAt(null);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [profileOpen]);

  return (
    <header className={styles.header}>
      {onLogout && (
        <button
          type="button"
          className={styles.menuBtn}
          aria-expanded={open}
          aria-label={t('메뉴')}
          onClick={toggleMenu}
        >
          =
        </button>
      )}
      <Link
        to="/calendar"
        className={styles.logo}
        // WF 3.1: 로고는 월간 캘린더(오늘)로 간다. 남은 주·일 보기와 기준일을 지운다
        onClick={() => {
          const c = useCalendarStore.getState();
          c.setView('month');
          c.setAnchorDate(null);
          c.setSelectedDate(null);
        }}
      >
        TodoList
      </Link>
      {onLogout && (
        <>
          <nav className={open ? styles.navOpen : styles.nav} onClick={closeMenu}>
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
                }
              >
                {t(tab.label)}
              </NavLink>
            ))}
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                isActive ? `${styles.settings} ${styles.settingsActive}` : styles.settings
              }
            >
              <GearIcon />
              {t('설정')}
            </NavLink>
          </nav>
          {/* inline-flex 항목 맨 앞 공백은 사라지므로 줄바꿈 없는 공백을 쓴다 */}
          <Link to="/todos/new" className={styles.newBtn}>
            {t('+ 새')}
            <span className={styles.wide}>&nbsp;{t('할일')}</span>
          </Link>
          <div className={styles.profile} ref={profileRef}>
            <button
              type="button"
              className={styles.avatar}
              aria-label={t('프로필')}
              aria-expanded={profileOpen}
              onClick={() => setOpenAt(profileOpen ? null : pathname)}
            >
              {user?.name.slice(0, 1)}
            </button>
            {profileOpen && (
              <div className={styles.popup}>
                {/* AC-19: 이름 변경이 바로 보인다 */}
                <div className={styles.popupName}>{user?.name}</div>
                <div className={styles.popupEmail}>{user?.email}</div>
                <button
                  type="button"
                  className={styles.logout}
                  disabled={logoutPending}
                  onClick={onLogout}
                >
                  {t('로그아웃')}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </header>
  );
}
