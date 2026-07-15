import { redirect } from "next/navigation";

import { TodayRecommendation } from "../../../features/today/today-recommendation";
import { getTodayRecommendation } from "../../../features/recommendation/get-today.server";
import { getTrainingRepository } from "../../../features/training/training-repository.server";
import { systemClock } from "../../../lib/clock";
import { toUtcDateKey } from "../../../lib/utc-date";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

function daysUntil(deadline: string, today: string): number {
  return Math.round(
    (Date.parse(`${deadline}T00:00:00.000Z`) -
      Date.parse(`${today}T00:00:00.000Z`)) /
      DAY_IN_MILLISECONDS,
  );
}

export default async function TodayPage() {
  const repository = getTrainingRepository();
  const profile = await repository.getProfile();

  if (profile === null) {
    redirect("/setup");
  }

  const today = toUtcDateKey(systemClock.now());

  if (profile.deadline < today) {
    redirect("/setup?reason=deadline-passed");
  }

  const recommendation = await getTodayRecommendation();
  const skillStates = await repository.getSkillStates();
  const dueReviewCount = skillStates.filter(
    ({ mastery, nextReviewDate }) =>
      mastery !== "unseen" &&
      nextReviewDate !== null &&
      nextReviewDate <= today,
  ).length;

  return (
    <TodayRecommendation
      daysRemaining={daysUntil(profile.deadline, today)}
      dueReviewCount={dueReviewCount}
      recommendation={recommendation}
      sessionMinutes={profile.minutesPerSession}
    />
  );
}
