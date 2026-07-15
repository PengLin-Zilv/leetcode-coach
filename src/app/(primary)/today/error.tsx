"use client";

import styles from "../../../features/today/today-recommendation.module.css";

export default function TodayError({ reset }: { reset(): void }) {
  return (
    <main className={styles.page}>
      <section className={styles.task}>
        <p className={styles.eyebrow}>Today</p>
        <h1>Your recommendation could not be loaded.</h1>
        <p>Your saved setup and practice history are unchanged.</p>
        <button className={styles.primaryAction} onClick={reset} type="button">
          Retry
        </button>
      </section>
    </main>
  );
}
