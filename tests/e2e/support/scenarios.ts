import { problemPatterns, problems, profiles } from "../../../src/db/schema";
import { openBrowserDatabase } from "./database";

export const FIRST_SESSION_PROFILE = {
  deadline: "2099-08-31",
  sessionsPerWeek: "4",
  minutesPerSession: "30",
  startingLevel: "new",
} as const;

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
