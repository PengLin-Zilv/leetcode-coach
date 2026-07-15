import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { getPracticeCookieConfig } from "../../config/env.server";
import { systemClock, type Clock } from "../../lib/clock";
import {
  parseActivePracticePayload,
  type ActivePractice,
} from "./active-practice";

export const ACTIVE_PRACTICE_COOKIE_NAME = "lc_active_practice";

function signatureFor(encodedPayload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(encodedPayload).digest();
}

function hasValidSignature(
  encodedPayload: string,
  encodedSignature: string,
  secret: string,
): boolean {
  const expected = signatureFor(encodedPayload, secret);
  const supplied = Buffer.from(encodedSignature, "base64url");
  const fixedLengthSupplied = Buffer.alloc(expected.length);
  supplied.copy(fixedLengthSupplied, 0, 0, expected.length);
  const matches = timingSafeEqual(fixedLengthSupplied, expected);

  return matches && supplied.length === expected.length;
}

export function encodeActivePracticeCookie(
  active: ActivePractice,
  secret: string,
): string {
  const encodedPayload = Buffer.from(JSON.stringify(active)).toString(
    "base64url",
  );
  const signature = signatureFor(encodedPayload, secret).toString("base64url");

  return `${encodedPayload}.${signature}`;
}

export function decodeActivePracticeCookie(
  value: string | undefined,
  routeProblemId: unknown,
  now: Date,
  secret: string,
): ActivePractice | null {
  if (value === undefined) {
    return null;
  }

  const parts = value.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [encodedPayload, encodedSignature] = parts;
  if (
    encodedPayload.length === 0 ||
    encodedSignature.length === 0 ||
    !hasValidSignature(encodedPayload, encodedSignature, secret)
  ) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );
  } catch {
    return null;
  }

  return parseActivePracticePayload(payload, routeProblemId, now);
}

export async function readActivePractice(
  routeProblemId: unknown,
  clock: Clock = systemClock,
): Promise<ActivePractice | null> {
  const cookieStore = await cookies();
  const { secret } = getPracticeCookieConfig();

  return decodeActivePracticeCookie(
    cookieStore.get(ACTIVE_PRACTICE_COOKIE_NAME)?.value,
    routeProblemId,
    clock.now(),
    secret,
  );
}

export async function writeActivePractice(
  active: ActivePractice,
): Promise<void> {
  const cookieStore = await cookies();
  const { secret } = getPracticeCookieConfig();

  cookieStore.set(
    ACTIVE_PRACTICE_COOKIE_NAME,
    encodeActivePracticeCookie(active, secret),
    {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    },
  );
}

export async function clearActivePractice(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_PRACTICE_COOKIE_NAME);
}
