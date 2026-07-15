import { redirect } from "next/navigation";

import { getProgress } from "../../../features/progress/get-progress.server";
import { ProgressSummary } from "../../../features/progress/progress-summary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ProgressPage() {
  const progress = await getProgress();

  if (progress === null) {
    redirect("/setup");
  }

  if (progress.profile.daysRemaining < 0) {
    redirect("/setup?reason=deadline-passed");
  }

  return <ProgressSummary progress={progress} />;
}
