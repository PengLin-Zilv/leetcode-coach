import { probeDatabase } from "../db/probe.server";
import { checkFoundationConnectivity } from "../features/foundation/connectivity";

import styles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Home() {
  const result = await checkFoundationConnectivity(probeDatabase, console);
  const statusCopy =
    result.status === "connected"
      ? "Database connected"
      : "Foundation unavailable";

  return (
    <main className={styles.page}>
      <section className={styles.content} aria-labelledby="foundation-heading">
        <h1 id="foundation-heading" className={styles.heading}>
          LeetCode Coach foundation
        </h1>
        <p
          className={styles.status}
          data-foundation-status={result.status}
          role="status"
        >
          {statusCopy}
        </p>
      </section>
    </main>
  );
}
