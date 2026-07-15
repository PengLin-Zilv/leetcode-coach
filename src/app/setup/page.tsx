import { getTrainingRepository } from "../../features/training/training-repository.server";
import { SetupForm } from "../../features/setup/setup-form";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const [profile, parameters] = await Promise.all([
    getTrainingRepository().getProfile(),
    searchParams,
  ]);
  const deadlinePassed = parameters.reason === "deadline-passed";

  return (
    <main>
      <SetupForm
        defaultValues={
          profile
            ? {
                deadline: profile.deadline,
                minutesPerSession: String(profile.minutesPerSession),
                sessionsPerWeek: String(profile.sessionsPerWeek),
                startingLevel: profile.startingLevel,
              }
            : undefined
        }
        message={
          deadlinePassed
            ? "Your interview date has passed. Choose a new target date to build your next session."
            : undefined
        }
      />
    </main>
  );
}
