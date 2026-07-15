import { describe, expect, it } from "vitest";

import {
  decodeActivePracticeCookie,
  encodeActivePracticeCookie,
} from "./active-practice.server";
import { startPractice } from "./active-practice";

const problemId = "0190f6f5-9b5a-7a22-8c44-123456789abd";
const otherProblemId = "0190f6f5-9b5a-7a22-8c44-123456789abe";
const now = new Date("2026-07-14T15:00:00.000Z");
const secret = "task-nine-test-practice-cookie-secret-value";

function tamperPayload(
  signedValue: string,
  mutate: (payload: Record<string, unknown>) => void,
): string {
  const [encodedPayload, signature] = signedValue.split(".");
  const payload = JSON.parse(
    Buffer.from(encodedPayload, "base64url").toString("utf8"),
  ) as Record<string, unknown>;
  mutate(payload);

  return `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${signature}`;
}

describe("authenticated active practice cookie", () => {
  const active = startPractice(problemId, new Date("2026-07-14T14:55:00.000Z"));

  it("round-trips an issued value only for its matching route", () => {
    const signedValue = encodeActivePracticeCookie(active, secret);

    expect(
      decodeActivePracticeCookie(signedValue, problemId, now, secret),
    ).toEqual(active);
    expect(
      decodeActivePracticeCookie(signedValue, otherProblemId, now, secret),
    ).toBeNull();
  });

  it.each([
    [
      "Problem ID",
      (payload: Record<string, unknown>) => {
        payload.problemId = otherProblemId;
      },
    ],
    [
      "start time",
      (payload: Record<string, unknown>) => {
        payload.startedAt = "2026-07-14T14:45:00.000Z";
      },
    ],
    [
      "hint level",
      (payload: Record<string, unknown>) => {
        payload.highestHintLevel = 1;
      },
    ],
  ] as const)(
    "rejects a well-shaped payload with a changed %s",
    (_label, mutate) => {
      const signedValue = encodeActivePracticeCookie(active, secret);

      expect(
        decodeActivePracticeCookie(
          tamperPayload(signedValue, mutate),
          problemId,
          now,
          secret,
        ),
      ).toBeNull();
    },
  );

  it("rejects a changed signature and a different signing secret", () => {
    const signedValue = encodeActivePracticeCookie(active, secret);
    const [payload, signature] = signedValue.split(".");
    const changedSignature = `${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}`;

    expect(
      decodeActivePracticeCookie(
        `${payload}.${changedSignature}`,
        problemId,
        now,
        secret,
      ),
    ).toBeNull();
    expect(
      decodeActivePracticeCookie(
        signedValue,
        problemId,
        now,
        "different-task-nine-test-cookie-secret",
      ),
    ).toBeNull();
  });

  it.each([
    undefined,
    "",
    "not-signed",
    "too.many.parts",
    "payload.invalid-signature",
  ])("rejects malformed signed value %s", (value) => {
    expect(
      decodeActivePracticeCookie(value, problemId, now, secret),
    ).toBeNull();
  });
});
