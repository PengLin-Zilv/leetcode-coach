import type { SkillMastery } from "../memory/project-skill-state";
import type { AttemptInput, ProfileInput } from "./contracts";

export type Profile = Readonly<{
  id: string;
  deadline: string;
  sessionsPerWeek: number;
  minutesPerSession: number;
  startingLevel: ProfileInput["startingLevel"];
}>;

export type Pattern = Readonly<{
  id: string;
  name: string;
  slug: string;
}>;

export type PatternPrerequisite = Readonly<{
  patternId: string;
  prerequisitePatternId: string;
}>;

export type Problem = Readonly<{
  id: string;
  number: number | null;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  url: string;
  estimatedMinutes: number;
  source: string;
}>;

export type ProblemPattern = Readonly<{
  problemId: string;
  patternId: string;
}>;

export type Attempt = Readonly<{
  id: string;
  problemId: string;
  result: AttemptInput["result"];
  durationMinutes: number;
  confidence: number | null;
  note: string | null;
  highestHintLevel: number;
  occurredAt: Date;
  createdAt: Date;
}>;

export type Reflection = Readonly<{
  id: string;
  body: string;
  occurredAt: Date;
  createdAt: Date;
}>;

export type SkillState = Readonly<{
  id: string;
  patternId: string;
  mastery: SkillMastery;
  recentSuccess: number;
  nextReviewDate: string | null;
  lastComputedAt: Date;
}>;

export interface TrainingRepository {
  getProfile(): Promise<Profile | null>;
  saveProfile(profile: Profile): Promise<void>;
  getPatterns(): Promise<readonly Pattern[]>;
  getPrerequisites(): Promise<readonly PatternPrerequisite[]>;
  getProblems(): Promise<readonly Problem[]>;
  getProblemPatterns(): Promise<readonly ProblemPattern[]>;
  getAttempts(): Promise<readonly Attempt[]>;
  getAttempt(id: string): Promise<Attempt | null>;
  insertAttempt(attempt: Attempt): Promise<void>;
  insertReflection(reflection: Reflection): Promise<void>;
  getSkillStates(): Promise<readonly SkillState[]>;
  replaceSkillStates(states: readonly SkillState[]): Promise<void>;
}
