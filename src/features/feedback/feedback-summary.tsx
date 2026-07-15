import Link from "next/link";

import { retryMemoryProjectionAction } from "../../app/feedback/[attemptId]/actions.server";
import type { FeedbackView } from "./get-feedback.server";
import styles from "./feedback-summary.module.css";

export function FeedbackSummary({
  feedback,
}: Readonly<{ feedback: FeedbackView }>) {
  const retryMemory = retryMemoryProjectionAction.bind(
    null,
    feedback.attempt.id,
  );

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="feedback-title">
        <p className={styles.eyebrow}>Session complete</p>
        <h1 id="feedback-title">{feedback.problemTitle}</h1>

        <div className={styles.section}>
          <h2>What worked</h2>
          <p>{feedback.observation}</p>
        </div>

        <div className={styles.section}>
          <h2>Keep this</h2>
          {feedback.mindFeedback === null ? (
            <p className={styles.unavailable} role="status">
              Coaching is temporarily unavailable. Your attempt and memory
              update are still saved.
            </p>
          ) : (
            <p>{feedback.mindFeedback}</p>
          )}
        </div>

        <div className={styles.section}>
          <h2>Review</h2>
          {feedback.memory.changes.map((change) => (
            <p key={change.patternId}>{change.reviewCue}</p>
          ))}
        </div>

        <div className={styles.memorySection}>
          <h2>
            {feedback.memory.status === "updated"
              ? "Memory updated"
              : "Memory update pending"}
          </h2>
          {feedback.memory.changes.map((change) => (
            <p className={styles.transition} key={change.patternId}>
              {change.patternName}: {capitalize(change.before)} →{" "}
              {capitalize(change.after)}
            </p>
          ))}
          {feedback.memory.status === "stale" ? (
            <>
              <p className={styles.pendingCopy}>
                The Attempt is saved. Rebuild memory from persisted Attempts to
                finish this update.
              </p>
              <form action={retryMemory}>
                <button className={styles.retry} type="submit">
                  Retry memory update
                </button>
              </form>
            </>
          ) : null}
        </div>

        <div className={styles.actions}>
          <Link className={styles.finish} href="/today">
            Finish
          </Link>
          <Link className={styles.progress} href="/progress">
            View progress
          </Link>
        </div>
      </section>
    </main>
  );
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
