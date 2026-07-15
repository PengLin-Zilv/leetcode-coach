import { eq, sql } from "drizzle-orm";

import {
  attempts,
  patterns,
  problemPatterns,
  problems,
  profiles,
  skillStates,
} from "../../../src/db/schema";
import { createId } from "../../../src/lib/id";
import { openBrowserDatabase } from "./database";

export const FIRST_SESSION_PROFILE = {
  deadline: "2099-08-31",
  sessionsPerWeek: "4",
  minutesPerSession: "30",
  startingLevel: "new",
} as const;

export const UNKNOWN_PROBLEM_ID = "0190f6f5-9b5a-7a22-8c44-123456789abc";
export const UNKNOWN_ATTEMPT_ID = "0190f6f5-9b5a-7a22-8c44-123456789abd";

export async function saveProfileScenario(
  overrides: Partial<{
    deadline: string;
    sessionsPerWeek: number;
    minutesPerSession: number;
    startingLevel: "new" | "some" | "reviewing";
  }> = {},
): Promise<void> {
  const connection = await openBrowserDatabase();

  try {
    await connection.database.insert(profiles).values({
      id: createId(),
      singletonKey: 1,
      deadline: overrides.deadline ?? FIRST_SESSION_PROFILE.deadline,
      sessionsPerWeek:
        overrides.sessionsPerWeek ??
        Number(FIRST_SESSION_PROFILE.sessionsPerWeek),
      minutesPerSession:
        overrides.minutesPerSession ??
        Number(FIRST_SESSION_PROFILE.minutesPerSession),
      startingLevel:
        overrides.startingLevel ?? FIRST_SESSION_PROFILE.startingLevel,
    });
  } finally {
    connection.close();
  }
}

export async function clearProblemCatalogScenario(): Promise<void> {
  const connection = await openBrowserDatabase();

  try {
    await connection.database.transaction(async (transaction) => {
      await transaction.delete(problemPatterns);
      await transaction.delete(problems);
    });
  } finally {
    connection.close();
  }
}

export async function createMissingMemoryScenario(): Promise<{
  attemptId: string;
  problemTitle: string;
}> {
  await saveProfileScenario();
  const connection = await openBrowserDatabase();

  try {
    const [problem] = await connection.database
      .select({ id: problems.id, title: problems.title })
      .from(problems)
      .where(eq(problems.title, "Contains Duplicate"))
      .limit(1);
    if (!problem) {
      throw new Error("Expected seeded Contains Duplicate problem");
    }

    const attemptId = createId();
    const occurredAt = new Date("2026-07-10T15:00:00.000Z");
    await connection.database.transaction(async (transaction) => {
      await transaction.insert(attempts).values({
        id: attemptId,
        problemId: problem.id,
        result: "solved",
        durationMinutes: 14,
        confidence: 4,
        note: "Independent set invariant.",
        highestHintLevel: 0,
        occurredAt,
        createdAt: occurredAt,
      });
      await transaction.delete(skillStates);
    });

    return { attemptId, problemTitle: problem.title };
  } finally {
    connection.close();
  }
}

export async function deleteSkillStatesScenario(): Promise<void> {
  const connection = await openBrowserDatabase();

  try {
    await connection.database.delete(skillStates);
  } finally {
    connection.close();
  }
}

export async function countSkillStatesScenario(): Promise<number> {
  const connection = await openBrowserDatabase();

  try {
    return (await connection.database.select().from(skillStates)).length;
  } finally {
    connection.close();
  }
}

export async function createLongContentScenario(): Promise<{
  problemId: string;
  patternName: string;
  reasonMinimumLength: number;
  title: string;
  longNote: string;
}> {
  await saveProfileScenario();
  return mutateLongCatalogScenario();
}

export async function createLongCatalogScenario(): Promise<{
  problemId: string;
  patternName: string;
  reasonMinimumLength: number;
  title: string;
  longNote: string;
}> {
  return mutateLongCatalogScenario();
}

async function mutateLongCatalogScenario(): Promise<{
  problemId: string;
  patternName: string;
  reasonMinimumLength: number;
  title: string;
  longNote: string;
}> {
  const connection = await openBrowserDatabase();
  const title = "Long interview problem title ".padEnd(100, "x");
  const patternName = "Long prerequisite pattern name ".padEnd(100, "p");
  const dependentPatternNames = [
    "Long dependent two pointers pattern ".padEnd(100, "q"),
    "Long dependent stack pattern ".padEnd(100, "r"),
  ] as const;
  const longNote = "Long independent evidence note. ".repeat(55);

  if (title.length !== 100) {
    throw new Error(
      "Long-content scenario title must be exactly 100 characters",
    );
  }

  try {
    const [problem] = await connection.database
      .select({ id: problems.id })
      .from(problems)
      .where(eq(problems.title, "Contains Duplicate"))
      .limit(1);
    if (!problem) {
      throw new Error("Expected seeded Contains Duplicate problem");
    }

    await connection.database
      .update(problems)
      .set({ title })
      .where(eq(problems.id, problem.id));

    for (const [currentName, longName] of [
      ["Arrays & Hashing", patternName],
      ["Two Pointers", dependentPatternNames[0]],
      ["Stack", dependentPatternNames[1]],
    ] as const) {
      await connection.database
        .update(patterns)
        .set({ name: longName })
        .where(eq(patterns.name, currentName));
    }

    return {
      problemId: problem.id,
      patternName,
      reasonMinimumLength: title.length + patternName.length + 120,
      title,
      longNote,
    };
  } finally {
    connection.close();
  }
}

export async function setProfileWriteFailureScenario(
  enabled: boolean,
): Promise<void> {
  const connection = await openBrowserDatabase();

  try {
    await connection.database.run(
      sql.raw("DROP TRIGGER IF EXISTS e2e_profile_write_failure"),
    );
    if (enabled) {
      await connection.database.run(
        sql.raw(
          "CREATE TRIGGER e2e_profile_write_failure BEFORE INSERT ON profiles BEGIN SELECT RAISE(ABORT, 'e2e profile write failure'); END",
        ),
      );
    }
  } finally {
    connection.close();
  }
}

export async function getSingletonProfileScenario() {
  const connection = await openBrowserDatabase();

  try {
    const [profile] = await connection.database
      .select({
        id: profiles.id,
        deadline: profiles.deadline,
        sessionsPerWeek: profiles.sessionsPerWeek,
        minutesPerSession: profiles.minutesPerSession,
        startingLevel: profiles.startingLevel,
      })
      .from(profiles)
      .limit(1);

    return profile ?? null;
  } finally {
    connection.close();
  }
}
