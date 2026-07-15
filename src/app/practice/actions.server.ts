"use server";

import "server-only";

import { redirect } from "next/navigation";
import { z } from "zod";

import { startPractice } from "../../features/practice/active-practice";
import { writeActivePractice } from "../../features/practice/active-practice.server";
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
  const [recommendation, skillStates, problemPatterns, problems] =
    await Promise.all([
      getTodayRecommendation(),
      repository.getSkillStates(),
      repository.getProblemPatterns(),
      repository.getProblems(),
    ]);
  const today = toUtcDateKey(now);
  const duePatternIds = new Set(
    skillStates
      .filter(
        ({ mastery, nextReviewDate }) =>
          mastery !== "unseen" &&
          nextReviewDate !== null &&
          nextReviewDate <= today,
      )
      .map(({ patternId }) => patternId),
  );
  const catalogProblemIds = new Set(problems.map(({ id }) => id));
  const dueProblemIds = new Set(
    problemPatterns
      .filter(({ patternId }) => duePatternIds.has(patternId))
      .map(({ problemId: dueProblemId }) => dueProblemId)
      .filter((dueProblemId) => catalogProblemIds.has(dueProblemId)),
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
