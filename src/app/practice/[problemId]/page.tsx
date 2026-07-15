import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { readActivePractice } from "../../../features/practice/active-practice.server";
import { PracticeSession } from "../../../features/practice/practice-session";
import { getTrainingRepository } from "../../../features/training/training-repository.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PracticePage({
  params,
}: Readonly<{ params: Promise<{ problemId: string }> }>) {
  const route = await params;
  const problemId = z.uuidv7().safeParse(route.problemId);

  if (!problemId.success) {
    notFound();
  }

  const repository = getTrainingRepository();
  const [active, problems, patterns, problemPatterns] = await Promise.all([
    readActivePractice(problemId.data),
    repository.getProblems(),
    repository.getPatterns(),
    repository.getProblemPatterns(),
  ]);

  if (active === null) {
    redirect("/today");
  }

  const problem = problems.find(({ id }) => id === problemId.data);
  const patternId = problemPatterns.find(
    ({ problemId: catalogProblemId }) => catalogProblemId === problemId.data,
  )?.patternId;
  const pattern = patterns.find(({ id }) => id === patternId);

  if (problem === undefined || pattern === undefined) {
    notFound();
  }

  return (
    <PracticeSession active={active} pattern={pattern} problem={problem} />
  );
}
