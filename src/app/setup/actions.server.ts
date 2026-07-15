"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  profileInputSchema,
  type ProfileInput,
} from "../../features/training/contracts";
import { getTrainingRepository } from "../../features/training/training-repository.server";
import { createId } from "../../lib/id";

export type SaveProfileActionState = Readonly<{
  fieldErrors?: Partial<Record<keyof ProfileInput, readonly string[]>>;
  formError?: string;
}>;

export async function saveProfileAction(
  _state: SaveProfileActionState,
  formData: FormData,
): Promise<SaveProfileActionState> {
  const parsed = profileInputSchema.safeParse({
    deadline: formData.get("deadline"),
    sessionsPerWeek: formData.get("sessionsPerWeek"),
    minutesPerSession: formData.get("minutesPerSession"),
    startingLevel: formData.get("startingLevel"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const repository = getTrainingRepository();
  const existingProfile = await repository.getProfile();

  try {
    await repository.saveProfile({
      id: existingProfile?.id ?? createId(),
      ...parsed.data,
    });
  } catch {
    return {
      formError: "Your setup could not be saved. Try again.",
    };
  }

  revalidatePath("/");
  revalidatePath("/today");
  revalidatePath("/progress");
  redirect("/today");
}
