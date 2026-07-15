import { startPracticeAction } from "../../app/practice/actions.server";
import type { SkillDisplayState } from "../memory/project-skill-state";
import type { ProgressViewModel } from "./get-progress.server";
import styles from "./progress-summary.module.css";

const displayStateLabels: Readonly<Record<SkillDisplayState, string>> = {
  unseen: "Unseen",
  learning: "Learning",
  practicing: "Practicing",
  reliable: "Reliable",
  review_due: "Review due",
};

export function ProgressSummary({
  progress,
}: Readonly<{ progress: ProgressViewModel }>) {
  const currentPatternId = progress.patterns.find(
    ({ displayState }) => displayState !== "reliable",
  )?.id;

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>Progress</p>
        <h1>Evidence from your practice</h1>
        <div className={styles.profileSummary} aria-label="Practice summary">
          <span>{formatDaysRemaining(progress.profile.daysRemaining)}</span>
          <span>{formatSessions(progress.profile.sessionsCompleted)}</span>
          <span>{formatDueCount(progress.profile.dueReviewCount)}</span>
        </div>
      </header>

      <section className={styles.section} aria-labelledby="roadmap-heading">
        <h2 id="roadmap-heading">Current path</h2>
        <ol className={styles.roadmap}>
          {progress.patterns.map((pattern) => (
            <li
              aria-current={
                pattern.id === currentPatternId ? "step" : undefined
              }
              key={pattern.id}
            >
              {pattern.name}
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section} aria-labelledby="evidence-heading">
        <h2 id="evidence-heading">Pattern evidence</h2>
        <div className={styles.tableFrame}>
          <table className={styles.evidenceTable}>
            <thead>
              <tr>
                <th scope="col">Pattern</th>
                <th scope="col">State</th>
                <th scope="col">Evidence</th>
                <th scope="col">Review</th>
              </tr>
            </thead>
            <tbody>
              {progress.patterns.map((pattern) => (
                <tr key={pattern.id}>
                  <th data-label="Pattern" scope="row">
                    {pattern.name}
                  </th>
                  <td data-label="State">
                    <span
                      className={styles.state}
                      data-state={pattern.displayState}
                    >
                      {displayStateLabels[pattern.displayState]}
                    </span>
                  </td>
                  <td data-label="Evidence">{pattern.evidenceSummary}</td>
                  <td data-label="Review">
                    {pattern.nextReviewDate === null
                      ? "—"
                      : `Review ${formatDate(pattern.nextReviewDate)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {progress.dueReviews.length > 0 ? (
        <section className={styles.section} aria-labelledby="due-heading">
          <h2 id="due-heading">Due reviews</h2>
          <div className={styles.tableFrame}>
            <table className={styles.dueTable}>
              <thead>
                <tr>
                  <th scope="col">Problem</th>
                  <th scope="col">Pattern</th>
                  <th scope="col">Due</th>
                  <th scope="col">
                    <span className={styles.visuallyHidden}>Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {progress.dueReviews.map((review) => (
                  <tr key={review.patternId}>
                    <th data-label="Problem" scope="row">
                      {review.problemTitle}
                    </th>
                    <td data-label="Pattern">{review.patternName}</td>
                    <td data-label="Due">
                      Due {formatDate(review.reviewDate)}
                    </td>
                    <td className={styles.actionCell} data-label="Action">
                      <form action={startPracticeAction}>
                        <input
                          name="problemId"
                          type="hidden"
                          value={review.problemId}
                        />
                        <button type="submit">Practice</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function formatDaysRemaining(days: number): string {
  if (days === 0) {
    return "Interview day";
  }

  return `${days} ${days === 1 ? "day" : "days"} left`;
}

function formatSessions(count: number): string {
  return `${count} ${count === 1 ? "session" : "sessions"} completed`;
}

function formatDueCount(count: number): string {
  return `${count} ${count === 1 ? "review" : "reviews"} due`;
}

function formatDate(dateKey: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T00:00:00.000Z`));
}
