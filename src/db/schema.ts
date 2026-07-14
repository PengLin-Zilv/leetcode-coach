import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable(
  "profiles",
  {
    id: text("id").notNull(),
    singletonKey: integer("singleton_key").notNull(),
    deadline: text("deadline").notNull(),
    sessionsPerWeek: integer("sessions_per_week").notNull(),
    minutesPerSession: integer("minutes_per_session").notNull(),
    startingLevel: text("starting_level", {
      enum: ["new", "some", "reviewing"],
    }).notNull(),
  },
  (table) => [
    primaryKey({ name: "profiles_id_pk", columns: [table.id] }),
    unique("profiles_singleton_key_unique").on(table.singletonKey),
    check("profiles_singleton_key_check", sql`${table.singletonKey} = 1`),
    check(
      "profiles_deadline_iso_date_check",
      sql`length(${table.deadline}) = 10 and ${table.deadline} glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`,
    ),
    check(
      "profiles_sessions_per_week_check",
      sql`${table.sessionsPerWeek} between 1 and 7`,
    ),
    check(
      "profiles_minutes_per_session_check",
      sql`${table.minutesPerSession} in (15, 30, 45, 60)`,
    ),
    check(
      "profiles_starting_level_check",
      sql`${table.startingLevel} in ('new', 'some', 'reviewing')`,
    ),
  ],
);

export const patterns = sqliteTable(
  "patterns",
  {
    id: text("id").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
  },
  (table) => [
    primaryKey({ name: "patterns_id_pk", columns: [table.id] }),
    unique("patterns_name_unique").on(table.name),
    unique("patterns_slug_unique").on(table.slug),
    check(
      "patterns_name_non_empty_check",
      sql`length(trim(${table.name})) > 0`,
    ),
    check(
      "patterns_slug_non_empty_check",
      sql`length(trim(${table.slug})) > 0`,
    ),
  ],
);

export const patternPrerequisites = sqliteTable(
  "pattern_prerequisites",
  {
    patternId: text("pattern_id").notNull(),
    prerequisitePatternId: text("prerequisite_pattern_id").notNull(),
  },
  (table) => [
    primaryKey({
      name: "pattern_prerequisites_pk",
      columns: [table.patternId, table.prerequisitePatternId],
    }),
    foreignKey({
      name: "pattern_prerequisites_pattern_id_fk",
      columns: [table.patternId],
      foreignColumns: [patterns.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "pattern_prerequisites_prerequisite_pattern_id_fk",
      columns: [table.prerequisitePatternId],
      foreignColumns: [patterns.id],
    }).onDelete("restrict"),
    check(
      "pattern_prerequisites_no_self_check",
      sql`${table.patternId} <> ${table.prerequisitePatternId}`,
    ),
    index("pattern_prerequisites_prerequisite_pattern_id_idx").on(
      table.prerequisitePatternId,
    ),
  ],
);

export const problems = sqliteTable(
  "problems",
  {
    id: text("id").notNull(),
    number: integer("number"),
    title: text("title").notNull(),
    difficulty: text("difficulty", {
      enum: ["easy", "medium", "hard"],
    }).notNull(),
    url: text("url").notNull(),
    estimatedMinutes: integer("estimated_minutes").notNull(),
    source: text("source").notNull(),
  },
  (table) => [
    primaryKey({ name: "problems_id_pk", columns: [table.id] }),
    unique("problems_number_unique").on(table.number),
    unique("problems_url_unique").on(table.url),
    check(
      "problems_number_positive_check",
      sql`${table.number} is null or ${table.number} > 0`,
    ),
    check(
      "problems_title_non_empty_check",
      sql`length(trim(${table.title})) > 0`,
    ),
    check("problems_url_non_empty_check", sql`length(trim(${table.url})) > 0`),
    check(
      "problems_difficulty_minutes_check",
      sql`(${table.difficulty} = 'easy' and ${table.estimatedMinutes} = 15)
        or (${table.difficulty} = 'medium' and ${table.estimatedMinutes} = 30)
        or (${table.difficulty} = 'hard' and ${table.estimatedMinutes} = 45)`,
    ),
    check(
      "problems_source_non_empty_check",
      sql`length(trim(${table.source})) > 0`,
    ),
  ],
);

export const problemPatterns = sqliteTable(
  "problem_patterns",
  {
    problemId: text("problem_id").notNull(),
    patternId: text("pattern_id").notNull(),
  },
  (table) => [
    primaryKey({
      name: "problem_patterns_pk",
      columns: [table.problemId, table.patternId],
    }),
    foreignKey({
      name: "problem_patterns_problem_id_fk",
      columns: [table.problemId],
      foreignColumns: [problems.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "problem_patterns_pattern_id_fk",
      columns: [table.patternId],
      foreignColumns: [patterns.id],
    }).onDelete("restrict"),
    index("problem_patterns_pattern_id_idx").on(table.patternId),
  ],
);

export const attempts = sqliteTable(
  "attempts",
  {
    id: text("id").notNull(),
    problemId: text("problem_id").notNull(),
    result: text("result", {
      enum: ["solved", "not_solved", "viewed_solution"],
    }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    confidence: integer("confidence"),
    note: text("note"),
    highestHintLevel: integer("highest_hint_level").notNull(),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    primaryKey({ name: "attempts_id_pk", columns: [table.id] }),
    foreignKey({
      name: "attempts_problem_id_fk",
      columns: [table.problemId],
      foreignColumns: [problems.id],
    }).onDelete("restrict"),
    check(
      "attempts_result_check",
      sql`${table.result} in ('solved', 'not_solved', 'viewed_solution')`,
    ),
    check(
      "attempts_duration_minutes_check",
      sql`${table.durationMinutes} >= 0`,
    ),
    check(
      "attempts_confidence_check",
      sql`${table.confidence} is null or ${table.confidence} between 1 and 5`,
    ),
    check(
      "attempts_highest_hint_level_check",
      sql`${table.highestHintLevel} between 0 and 4`,
    ),
    check(
      "attempts_occurred_before_created_check",
      sql`${table.occurredAt} <= ${table.createdAt}`,
    ),
    index("attempts_problem_id_occurred_at_idx").on(
      table.problemId,
      table.occurredAt,
    ),
  ],
);

export const reflections = sqliteTable(
  "reflections",
  {
    id: text("id").notNull(),
    body: text("body").notNull(),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    primaryKey({ name: "reflections_id_pk", columns: [table.id] }),
    check(
      "reflections_body_non_empty_check",
      sql`length(trim(${table.body})) > 0`,
    ),
    check(
      "reflections_occurred_before_created_check",
      sql`${table.occurredAt} <= ${table.createdAt}`,
    ),
    index("reflections_occurred_at_idx").on(table.occurredAt),
  ],
);

export const mindOutputs = sqliteTable(
  "mind_outputs",
  {
    id: text("id").notNull(),
    type: text("type", { enum: ["single", "pattern"] }).notNull(),
    body: text("body").notNull(),
    attemptId: text("attempt_id"),
    patternId: text("pattern_id"),
    generatedAt: integer("generated_at", { mode: "timestamp_ms" }).notNull(),
    modelMeta: text("model_meta", { mode: "json" }).$type<
      Readonly<Record<string, unknown>>
    >(),
  },
  (table) => [
    primaryKey({ name: "mind_outputs_id_pk", columns: [table.id] }),
    foreignKey({
      name: "mind_outputs_attempt_id_fk",
      columns: [table.attemptId],
      foreignColumns: [attempts.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "mind_outputs_pattern_id_fk",
      columns: [table.patternId],
      foreignColumns: [patterns.id],
    }).onDelete("restrict"),
    check(
      "mind_outputs_body_non_empty_check",
      sql`length(trim(${table.body})) > 0`,
    ),
    check(
      "mind_outputs_shape_check",
      sql`(${table.type} = 'single' and ${table.attemptId} is not null and ${table.patternId} is null)
        or (${table.type} = 'pattern' and ${table.attemptId} is null and ${table.patternId} is not null)`,
    ),
  ],
);

export const mindOutputSourceAttempts = sqliteTable(
  "mind_output_source_attempts",
  {
    mindOutputId: text("mind_output_id").notNull(),
    attemptId: text("attempt_id").notNull(),
  },
  (table) => [
    primaryKey({
      name: "mind_output_source_attempts_pk",
      columns: [table.mindOutputId, table.attemptId],
    }),
    foreignKey({
      name: "mind_output_source_attempts_mind_output_id_fk",
      columns: [table.mindOutputId],
      foreignColumns: [mindOutputs.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "mind_output_source_attempts_attempt_id_fk",
      columns: [table.attemptId],
      foreignColumns: [attempts.id],
    }).onDelete("restrict"),
    index("mind_output_source_attempts_attempt_id_idx").on(table.attemptId),
  ],
);

export const skillStates = sqliteTable(
  "skill_states",
  {
    id: text("id").notNull(),
    patternId: text("pattern_id").notNull(),
    mastery: text("mastery", {
      enum: ["unseen", "learning", "practicing", "reliable"],
    }).notNull(),
    recentSuccess: integer("recent_success").notNull(),
    nextReviewDate: text("next_review_date"),
    lastComputedAt: integer("last_computed_at", {
      mode: "timestamp_ms",
    }).notNull(),
  },
  (table) => [
    primaryKey({ name: "skill_states_id_pk", columns: [table.id] }),
    unique("skill_states_pattern_id_unique").on(table.patternId),
    foreignKey({
      name: "skill_states_pattern_id_fk",
      columns: [table.patternId],
      foreignColumns: [patterns.id],
    }).onDelete("restrict"),
    check(
      "skill_states_mastery_check",
      sql`${table.mastery} in ('unseen', 'learning', 'practicing', 'reliable')`,
    ),
    check(
      "skill_states_recent_success_check",
      sql`${table.recentSuccess} between 0 and 3`,
    ),
    check(
      "skill_states_next_review_date_iso_check",
      sql`${table.nextReviewDate} is null or (length(${table.nextReviewDate}) = 10 and ${table.nextReviewDate} glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')`,
    ),
    check(
      "skill_states_unseen_consistency_check",
      sql`(${table.mastery} = 'unseen' and ${table.recentSuccess} = 0 and ${table.nextReviewDate} is null)
        or (${table.mastery} <> 'unseen' and ${table.nextReviewDate} is not null)`,
    ),
    index("skill_states_next_review_date_idx").on(table.nextReviewDate),
  ],
);
