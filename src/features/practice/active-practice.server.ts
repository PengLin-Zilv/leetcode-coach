import "server-only";

import { cookies } from "next/headers";

import { systemClock, type Clock } from "../../lib/clock";
import {
  parseActivePracticeCookie,
  type ActivePractice,
} from "./active-practice";

export const ACTIVE_PRACTICE_COOKIE_NAME = "lc_active_practice";

export async function readActivePractice(
  routeProblemId: unknown,
  clock: Clock = systemClock,
): Promise<ActivePractice | null> {
  const cookieStore = await cookies();

  return parseActivePracticeCookie(
    cookieStore.get(ACTIVE_PRACTICE_COOKIE_NAME)?.value,
    routeProblemId,
    clock.now(),
  );
}

export async function writeActivePractice(
  active: ActivePractice,
): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(ACTIVE_PRACTICE_COOKIE_NAME, JSON.stringify(active), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
}
