"use client";

import styles from "./status.module.css";

export default function GlobalError({ reset }: { reset(): void }) {
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <p className={styles.errorEyebrow}>Something went wrong</p>
        <h1>LeetCode Coach could not load this page.</h1>
        <p>
          Your saved training data is unchanged. Try loading the page again.
        </p>
        <button className={styles.action} onClick={reset} type="button">
          Try again
        </button>
      </section>
    </main>
  );
}
