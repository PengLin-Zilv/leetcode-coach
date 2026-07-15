"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { rebuildMemory } from "../../../features/memory/rebuild-memory.server";
import { getTrainingRepository } from "../../../features/training/training-repository.server";
import { systemClock } from "../../../lib/clock";
import { createId } from "../../../lib/id";

const attemptIdSchema = z.uuidv7();

export async function retryMemoryProjectionAction(
  untrustedAttemptId: string,
): Promise<void> {
  const attemptId = attemptIdSchema.safeParse(untrustedAttemptId);
  if (!attemptId.success) {
    redirect("/today");
  }

  const repository = getTrainingRepository();
  const attempt = await repository.getAttempt(attemptId.data);
  if (attempt === null) {
    redirect("/today");
  }

  try {
    await rebuildMemory({ repository, ids: createId, clock: systemClock });
  } catch {
    // Persistence remains the source of truth; another retry can rebuild it.
  }

  revalidatePath("/today");
  revalidatePath("/progress");
  revalidatePath(`/feedback/${attemptId.data}`);
  redirect(`/feedback/${attemptId.data}`);
}
