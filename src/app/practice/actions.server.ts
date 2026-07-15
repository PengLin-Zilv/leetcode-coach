"use server";

import "server-only";

import { redirect } from "next/navigation";
import { z } from "zod";

import { startPractice } from "../../features/practice/active-practice";
import { writeActivePractice } from "../../features/practice/active-practice.server";
import { selectDueReviews } from "../../features/progress/select-due-reviews";
import { getTodayRecommendation } from "../../features/recommendation/get-today.server";
import { getTrainingRepository } from "../../features/training/training-repository.server";
import { systemClock } from "../../lib/clock";
import { toUtcDateKey } from "../../lib/utc-date";

const problemIdSchema = z.uuidv7();

export async function startPracticeAction(formData: FormData): Promise<void> {
  const parsedProblemId = problemIdSchema.safeParse(formData.get("problemId"));

  if (!parsedProblemId.success) {
    redirect("/today");
  }

  const problemId = parsedProblemId.data;
  const now = systemClock.now();
  const repository = getTrainingRepository();
  const recommendation = await getTodayRecommendation();
  const [patterns, problems, problemPatterns, attempts, skillStates] =
    await Promise.all([
      repository.getPatterns(),
      repository.getProblems(),
      repository.getProblemPatterns(),
      repository.getAttempts(),
      repository.getSkillStates(),
    ]);
  const dueProblemIds = new Set(
    selectDueReviews({
      patterns,
      problems,
      problemPatterns,
      attempts,
      skillStates,
      today: toUtcDateKey(now),
    }).map(({ problemId: dueProblemId }) => dueProblemId),
  );
  const isCurrentRecommendation =
    recommendation.status === "recommended" &&
    recommendation.problem.id === problemId;

  if (!isCurrentRecommendation && !dueProblemIds.has(problemId)) {
    redirect("/today");
  }

  await writeActivePractice(startPractice(problemId, now));
  redirect(`/practice/${problemId}`);
}
