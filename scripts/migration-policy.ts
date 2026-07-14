export type MigrationTarget = "local" | "production";

export interface MigrationRequest {
  readonly target: MigrationTarget;
  readonly envFile: ".env.local" | ".env.production.local";
}

export function resolveMigrationRequest(args: string[]): MigrationRequest {
  const target = args[0];

  if (target !== "local" && target !== "production") {
    throw new Error("Migration target must be local or production");
  }

  if (target === "production" && !args.includes("--confirm-production")) {
    throw new Error("Production migration requires --confirm-production");
  }

  return target === "local"
    ? { target, envFile: ".env.local" }
    : { target, envFile: ".env.production.local" };
}
