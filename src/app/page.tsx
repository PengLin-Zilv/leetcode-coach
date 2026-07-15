import { redirect } from "next/navigation";

import { getTrainingRepository } from "../features/training/training-repository.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Home() {
  const profile = await getTrainingRepository().getProfile();

  redirect(profile === null ? "/setup" : "/today");
}
