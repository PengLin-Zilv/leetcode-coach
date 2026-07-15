import { notFound } from "next/navigation";

import { FeedbackSummary } from "../../../features/feedback/feedback-summary";
import { getFeedback } from "../../../features/feedback/get-feedback.server";
import { ClearPracticeDraft } from "../../../features/practice/clear-practice-draft";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function FeedbackPage({
  params,
}: Readonly<{ params: Promise<{ attemptId: string }> }>) {
  const { attemptId } = await params;
  const feedback = await getFeedback(attemptId);
  if (feedback === null) {
    notFound();
  }

  return (
    <>
      <ClearPracticeDraft problemId={feedback.attempt.problemId} />
      <FeedbackSummary feedback={feedback} />
    </>
  );
}
