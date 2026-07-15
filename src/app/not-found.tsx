import Link from "next/link";

import styles from "./status.module.css";

export default function NotFound() {
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <p className={styles.eyebrow}>Page not found</p>
        <h1>That practice view does not exist.</h1>
        <p>Return to your current recommendation to keep moving.</p>
        <Link className={styles.action} href="/today">
          Go to Today
        </Link>
      </section>
    </main>
  );
}
