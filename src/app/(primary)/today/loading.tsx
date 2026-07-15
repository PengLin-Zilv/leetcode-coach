import styles from "../../../features/today/today-recommendation.module.css";

export default function TodayLoading() {
  return (
    <main className={styles.page} aria-busy="true">
      <div className={styles.context} aria-hidden="true">
        <span>Today</span>
      </div>
      <section className={styles.task}>
        <p className={styles.eyebrow}>Today</p>
        <h1>Preparing your next task</h1>
        <p role="status">Loading recommendation…</p>
      </section>
    </main>
  );
}
