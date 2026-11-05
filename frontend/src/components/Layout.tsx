import { Outlet } from 'react-router';
import { Header } from './Header';
import { TopAlert } from './TopAlert';
import styles from './Layout.module.css';

interface Props {
  onLogout?: () => void;
  logoutPending?: boolean;
  userName?: string;
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
