import styles from "./app-shell.module.css";
import { PrimaryNav } from "./primary-nav";

export function AppShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <span className={styles.brand}>LeetCode Coach</span>
          <PrimaryNav />
        </div>
      </header>
      <div className={styles.content}>{children}</div>
    </>
  );
}
