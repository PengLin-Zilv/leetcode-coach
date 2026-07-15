import Link from "next/link";

import type { RecommendationResult } from "../recommendation/recommend-next";
import styles from "./today-recommendation.module.css";

export function TodayRecommendation({
  daysRemaining,
  dueReviewCount,
  recommendation,
  sessionMinutes,
}: Readonly<{
  daysRemaining: number;
  dueReviewCount: number;
  recommendation: RecommendationResult;
  sessionMinutes: number;
}>) {
  if (recommendation.status === "unavailable") {
    const message =
      recommendation.reason === "catalog_empty"
        ? "The practice catalog is unavailable right now."
        : `No catalog task fits your ${sessionMinutes}-minute session yet.`;

    return (
      <main className={styles.page}>
        <div className={styles.context}>
          <span>{formatDeadline(daysRemaining)}</span>
          <span>{sessionMinutes}-minute session</span>
        </div>
        <section className={styles.task}>
          <p className={styles.eyebrow}>Today</p>
          <h1>We could not choose a task yet.</h1>
          <p>{message}</p>
          <form action="/today" method="get">
            <button className={styles.primaryAction} type="submit">
              Retry recommendation
            </button>
          </form>
        </section>
      </main>
    );
  }

  const { problem, pattern, reason } = recommendation;

  return (
    <main className={styles.page}>
      <div className={styles.context}>
        <span>{formatDeadline(daysRemaining)}</span>
        <span>{sessionMinutes}-minute session</span>
      </div>

      <section className={styles.task} aria-labelledby="today-task">
        <p className={styles.eyebrow}>Today</p>
        <p className={styles.pattern}>{pattern.name}</p>
        <div className={styles.titleRow}>
          <h1 id="today-task">{problem.title}</h1>
          <span className={styles.difficulty}>
            {capitalize(problem.difficulty)}
          </span>
        </div>
        <p className={styles.target}>
          {problem.estimatedMinutes} minute target
        </p>

        <div className={styles.reason}>
          <h2>Why this</h2>
          <p>{reason}</p>
        </div>

        <form>
          <input name="problemId" type="hidden" value={problem.id} />
          <button className={styles.primaryAction} type="submit">
            Start session
          </button>
        </form>
      </section>

      {dueReviewCount > 0 ? (
        <div className={styles.reviewRow}>
          <span>
            {dueReviewCount} {dueReviewCount === 1 ? "review" : "reviews"} due
          </span>
          <Link href="/progress">View progress</Link>
        </div>
      ) : null}
    </main>
  );
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function formatDeadline(daysRemaining: number): string {
  if (daysRemaining === 0) {
    return "Interview day";
  }

  return `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} until interview`;
}
