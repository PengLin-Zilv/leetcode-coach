CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`problem_id` text NOT NULL,
	`result` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`confidence` integer,
	`note` text,
	`highest_hint_level` integer NOT NULL,
	`occurred_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`problem_id`) REFERENCES `problems`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "attempts_result_check" CHECK("attempts"."result" in ('solved', 'not_solved', 'viewed_solution')),
	CONSTRAINT "attempts_duration_minutes_check" CHECK("attempts"."duration_minutes" >= 0),
	CONSTRAINT "attempts_confidence_check" CHECK("attempts"."confidence" is null or "attempts"."confidence" between 1 and 5),
	CONSTRAINT "attempts_highest_hint_level_check" CHECK("attempts"."highest_hint_level" between 0 and 4),
	CONSTRAINT "attempts_occurred_before_created_check" CHECK("attempts"."occurred_at" <= "attempts"."created_at")
);
--> statement-breakpoint
CREATE INDEX `attempts_problem_id_occurred_at_idx` ON `attempts` (`problem_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `mind_output_source_attempts` (
	`mind_output_id` text NOT NULL,
	`attempt_id` text NOT NULL,
	PRIMARY KEY(`mind_output_id`, `attempt_id`),
	FOREIGN KEY (`mind_output_id`) REFERENCES `mind_outputs`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `mind_output_source_attempts_attempt_id_idx` ON `mind_output_source_attempts` (`attempt_id`);--> statement-breakpoint
CREATE TABLE `mind_outputs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`body` text NOT NULL,
	`attempt_id` text,
	`pattern_id` text,
	`generated_at` integer NOT NULL,
	`model_meta` text,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`pattern_id`) REFERENCES `patterns`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "mind_outputs_body_non_empty_check" CHECK(length(trim("mind_outputs"."body")) > 0),
	CONSTRAINT "mind_outputs_shape_check" CHECK(("mind_outputs"."type" = 'single' and "mind_outputs"."attempt_id" is not null and "mind_outputs"."pattern_id" is null)
        or ("mind_outputs"."type" = 'pattern' and "mind_outputs"."attempt_id" is null and "mind_outputs"."pattern_id" is not null))
);
--> statement-breakpoint
CREATE TABLE `pattern_prerequisites` (
	`pattern_id` text NOT NULL,
	`prerequisite_pattern_id` text NOT NULL,
	PRIMARY KEY(`pattern_id`, `prerequisite_pattern_id`),
	FOREIGN KEY (`pattern_id`) REFERENCES `patterns`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`prerequisite_pattern_id`) REFERENCES `patterns`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "pattern_prerequisites_no_self_check" CHECK("pattern_prerequisites"."pattern_id" <> "pattern_prerequisites"."prerequisite_pattern_id")
);
--> statement-breakpoint
CREATE INDEX `pattern_prerequisites_prerequisite_pattern_id_idx` ON `pattern_prerequisites` (`prerequisite_pattern_id`);--> statement-breakpoint
CREATE TABLE `patterns` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	CONSTRAINT "patterns_name_non_empty_check" CHECK(length(trim("patterns"."name")) > 0),
	CONSTRAINT "patterns_slug_non_empty_check" CHECK(length(trim("patterns"."slug")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patterns_name_unique` ON `patterns` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `patterns_slug_unique` ON `patterns` (`slug`);--> statement-breakpoint
CREATE TABLE `problem_patterns` (
	`problem_id` text NOT NULL,
	`pattern_id` text NOT NULL,
	PRIMARY KEY(`problem_id`, `pattern_id`),
	FOREIGN KEY (`problem_id`) REFERENCES `problems`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`pattern_id`) REFERENCES `patterns`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `problem_patterns_pattern_id_idx` ON `problem_patterns` (`pattern_id`);--> statement-breakpoint
CREATE TABLE `problems` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer,
	`title` text NOT NULL,
	`difficulty` text NOT NULL,
	`url` text NOT NULL,
	`estimated_minutes` integer NOT NULL,
	`source` text NOT NULL,
	CONSTRAINT "problems_number_positive_check" CHECK("problems"."number" is null or "problems"."number" > 0),
	CONSTRAINT "problems_title_non_empty_check" CHECK(length(trim("problems"."title")) > 0),
	CONSTRAINT "problems_url_non_empty_check" CHECK(length(trim("problems"."url")) > 0),
	CONSTRAINT "problems_difficulty_minutes_check" CHECK(("problems"."difficulty" = 'easy' and "problems"."estimated_minutes" = 15)
        or ("problems"."difficulty" = 'medium' and "problems"."estimated_minutes" = 30)
        or ("problems"."difficulty" = 'hard' and "problems"."estimated_minutes" = 45)),
	CONSTRAINT "problems_source_non_empty_check" CHECK(length(trim("problems"."source")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `problems_number_unique` ON `problems` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `problems_url_unique` ON `problems` (`url`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`singleton_key` integer NOT NULL,
	`deadline` text NOT NULL,
	`sessions_per_week` integer NOT NULL,
	`minutes_per_session` integer NOT NULL,
	`starting_level` text NOT NULL,
	CONSTRAINT "profiles_singleton_key_check" CHECK("profiles"."singleton_key" = 1),
	CONSTRAINT "profiles_deadline_iso_date_check" CHECK(length("profiles"."deadline") = 10 and "profiles"."deadline" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "profiles_sessions_per_week_check" CHECK("profiles"."sessions_per_week" between 1 and 7),
	CONSTRAINT "profiles_minutes_per_session_check" CHECK("profiles"."minutes_per_session" in (15, 30, 45, 60)),
	CONSTRAINT "profiles_starting_level_check" CHECK("profiles"."starting_level" in ('new', 'some', 'reviewing'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_singleton_key_unique` ON `profiles` (`singleton_key`);--> statement-breakpoint
CREATE TABLE `reflections` (
	`id` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "reflections_body_non_empty_check" CHECK(length(trim("reflections"."body")) > 0),
	CONSTRAINT "reflections_occurred_before_created_check" CHECK("reflections"."occurred_at" <= "reflections"."created_at")
);
--> statement-breakpoint
CREATE INDEX `reflections_occurred_at_idx` ON `reflections` (`occurred_at`);--> statement-breakpoint
CREATE TABLE `skill_states` (
	`id` text PRIMARY KEY NOT NULL,
	`pattern_id` text NOT NULL,
	`mastery` text NOT NULL,
	`recent_success` integer NOT NULL,
	`next_review_date` text,
	`last_computed_at` integer NOT NULL,
	FOREIGN KEY (`pattern_id`) REFERENCES `patterns`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "skill_states_mastery_check" CHECK("skill_states"."mastery" in ('unseen', 'learning', 'practicing', 'reliable')),
	CONSTRAINT "skill_states_recent_success_check" CHECK("skill_states"."recent_success" between 0 and 3),
	CONSTRAINT "skill_states_next_review_date_iso_check" CHECK("skill_states"."next_review_date" is null or (length("skill_states"."next_review_date") = 10 and "skill_states"."next_review_date" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')),
	CONSTRAINT "skill_states_unseen_consistency_check" CHECK(("skill_states"."mastery" = 'unseen' and "skill_states"."recent_success" = 0 and "skill_states"."next_review_date" is null)
        or ("skill_states"."mastery" <> 'unseen' and "skill_states"."next_review_date" is not null))
);
--> statement-breakpoint
CREATE INDEX `skill_states_next_review_date_idx` ON `skill_states` (`next_review_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `skill_states_pattern_id_unique` ON `skill_states` (`pattern_id`);