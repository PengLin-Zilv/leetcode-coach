import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { AttemptReflectionForm } from "../../../../features/attempt/attempt-reflection-form";
import { readActivePractice } from "../../../../features/practice/active-practice.server";
import { getTrainingRepository } from "../../../../features/training/training-repository.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AttemptReflectionPage({
  params,
}: Readonly<{ params: Promise<{ problemId: string }> }>) {
  const route = await params;
  const problemId = z.uuidv7().safeParse(route.problemId);
  if (!problemId.success) {
    notFound();
  }

  const repository = getTrainingRepository();
  const [active, problems] = await Promise.all([
    readActivePractice(problemId.data),
    repository.getProblems(),
  ]);
  const problem = problems.find(({ id }) => id === problemId.data);
  if (problem === undefined) {
    notFound();
  }

  if (active === null) {
    redirect("/today");
  }

  return (
    <AttemptReflectionForm
      highestHintLevel={active.highestHintLevel}
      problemId={problem.id}
      problemTitle={problem.title}
      startedAt={active.startedAt}
    />
  );
}
