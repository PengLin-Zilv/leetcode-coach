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

const PROFILE_FIELD_ERROR_MESSAGES = {
  deadline: "Enter a valid interview date.",
  sessionsPerWeek: "Choose 1 to 7 sessions per week.",
  minutesPerSession: "Choose 15, 30, 45, or 60 minutes.",
  startingLevel: "Choose your starting point.",
} as const satisfies Record<keyof ProfileInput, string>;

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
    const validationErrors = parsed.error.flatten().fieldErrors;
    const fieldErrors: Partial<Record<keyof ProfileInput, readonly string[]>> =
      {};

    for (const field of Object.keys(PROFILE_FIELD_ERROR_MESSAGES) as Array<
      keyof ProfileInput
    >) {
      if (validationErrors[field]?.length) {
        fieldErrors[field] = [PROFILE_FIELD_ERROR_MESSAGES[field]];
      }
    }

    return { fieldErrors };
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
