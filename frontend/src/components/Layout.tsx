import { Outlet } from 'react-router';
import { Header } from './Header';
import { TopAlert } from './TopAlert';
import styles from './Layout.module.css';

interface Props {
  onLogout?: () => void;
  logoutPending?: boolean;
  user?: { name: string; email: string };
}

export function Layout(props: Props) {
  return (
    <>
      <Header {...props} />
      <TopAlert />
      <main className={styles.main}>
        <Outlet />
      </main>
    </>
  );
}
