import { notFound } from "next/navigation";

import { FeedbackSummary } from "../../../features/feedback/feedback-summary";
import { getFeedback } from "../../../features/feedback/get-feedback.server";
import { practiceDraftStorageKey } from "../../../features/practice/active-practice";
import { verifyPracticeDraftCleanupToken } from "../../../features/practice/active-practice.server";
import { ClearPracticeDraft } from "../../../features/practice/clear-practice-draft";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function FeedbackPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ attemptId: string }>;
  searchParams: Promise<{ cleanup?: string | string[] }>;
}>) {
  const [{ attemptId }, query] = await Promise.all([params, searchParams]);
  const feedback = await getFeedback(attemptId);
  if (feedback === null) {
    notFound();
  }

  const cleanupIdentity = verifyPracticeDraftCleanupToken(
    typeof query.cleanup === "string" ? query.cleanup : undefined,
    feedback.attempt.id,
    feedback.attempt.problemId,
  );
  const cleanupStorageKey = cleanupIdentity
    ? practiceDraftStorageKey(
        cleanupIdentity.problemId,
        cleanupIdentity.startedAt,
      )
    : null;

  return (
    <>
      {cleanupStorageKey ? (
        <ClearPracticeDraft storageKey={cleanupStorageKey} />
      ) : null}
      <FeedbackSummary feedback={feedback} />
    </>
  );
}
