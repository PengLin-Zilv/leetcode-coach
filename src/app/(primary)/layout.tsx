import { redirect } from "next/navigation";

import { AppShell } from "../../components/app-shell";
import { getTrainingRepository } from "../../features/training/training-repository.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PrimaryLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await getTrainingRepository().getProfile();

  if (profile === null) {
    redirect("/setup");
  }

  return <AppShell>{children}</AppShell>;
}
