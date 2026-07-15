"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  saveProfileAction,
  type SaveProfileActionState,
} from "../../app/setup/actions.server";
import { SubmitButton } from "../../components/submit-button";
import styles from "./setup-form.module.css";

type SetupValues = Readonly<{
  deadline: string;
  sessionsPerWeek: string;
  minutesPerSession: string;
  startingLevel: string;
}>;

const EMPTY_VALUES: SetupValues = {
  deadline: "",
  sessionsPerWeek: "",
  minutesPerSession: "",
  startingLevel: "",
};

const INITIAL_STATE: SaveProfileActionState = {};

export function SetupForm({
  defaultValues = EMPTY_VALUES,
  message,
}: Readonly<{
  defaultValues?: SetupValues;
  message?: string;
}>) {
  const [state, action] = useActionState(saveProfileAction, INITIAL_STATE);
  const [values, setValues] = useState(defaultValues);
  const deadlineRef = useRef<HTMLInputElement>(null);
  const sessionsPerWeekRef = useRef<HTMLSelectElement>(null);
  const minutesPerSessionRef = useRef<HTMLSelectElement>(null);
  const startingLevelRef = useRef<HTMLSelectElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);
  const isComplete = Object.values(values).every((value) => value !== "");

  useEffect(() => {
    const firstInvalid = state.fieldErrors?.deadline
      ? deadlineRef.current
      : state.fieldErrors?.sessionsPerWeek
        ? sessionsPerWeekRef.current
        : state.fieldErrors?.minutesPerSession
          ? minutesPerSessionRef.current
          : state.fieldErrors?.startingLevel
            ? startingLevelRef.current
            : null;
    (firstInvalid ?? (state.formError ? formErrorRef.current : null))?.focus();
  }, [state]);

  function updateValue(field: keyof SetupValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className={styles.page}>
      <div className={styles.brand}>LeetCode Coach</div>
      <section className={styles.panel} aria-labelledby="setup-heading">
        <p className={styles.eyebrow}>Your practice plan</p>
        <h1 id="setup-heading">Build your first practice session</h1>
        <p className={styles.intro}>
          Give us the time you have. Your plan will calibrate from real
          attempts, not a long diagnostic.
        </p>

        {message ? (
          <p className={styles.notice} role="status">
            {message}
          </p>
        ) : null}

        <form action={action} className={styles.form} noValidate>
          <div className={styles.field}>
            <label htmlFor="deadline">Interview date</label>
            <input
              aria-describedby={
                state.fieldErrors?.deadline ? "deadline-error" : undefined
              }
              aria-invalid={Boolean(state.fieldErrors?.deadline)}
              id="deadline"
              name="deadline"
              onChange={(event) => updateValue("deadline", event.target.value)}
              required
              ref={deadlineRef}
              type="date"
              value={values.deadline}
            />
            <FieldError
              id="deadline-error"
              messages={state.fieldErrors?.deadline}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="sessionsPerWeek">Sessions each week</label>
            <select
              aria-describedby={
                state.fieldErrors?.sessionsPerWeek
                  ? "sessions-per-week-error"
                  : undefined
              }
              aria-invalid={Boolean(state.fieldErrors?.sessionsPerWeek)}
              id="sessionsPerWeek"
              name="sessionsPerWeek"
              onChange={(event) =>
                updateValue("sessionsPerWeek", event.target.value)
              }
              required
              ref={sessionsPerWeekRef}
              value={values.sessionsPerWeek}
            >
              <option disabled value="">
                Select sessions
              </option>
              {[1, 2, 3, 4, 5, 6, 7].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
            <FieldError
              id="sessions-per-week-error"
              messages={state.fieldErrors?.sessionsPerWeek}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="minutesPerSession">Minutes per session</label>
            <select
              aria-describedby={
                state.fieldErrors?.minutesPerSession
                  ? "minutes-per-session-error"
                  : undefined
              }
              aria-invalid={Boolean(state.fieldErrors?.minutesPerSession)}
              id="minutesPerSession"
              name="minutesPerSession"
              onChange={(event) =>
                updateValue("minutesPerSession", event.target.value)
              }
              required
              ref={minutesPerSessionRef}
              value={values.minutesPerSession}
            >
              <option disabled value="">
                Select minutes
              </option>
              {[15, 30, 45, 60].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes}
                </option>
              ))}
            </select>
            <FieldError
              id="minutes-per-session-error"
              messages={state.fieldErrors?.minutesPerSession}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="startingLevel">Starting point</label>
            <select
              aria-describedby={
                state.fieldErrors?.startingLevel
                  ? "starting-level-error"
                  : undefined
              }
              aria-invalid={Boolean(state.fieldErrors?.startingLevel)}
              id="startingLevel"
              name="startingLevel"
              onChange={(event) =>
                updateValue("startingLevel", event.target.value)
              }
              required
              ref={startingLevelRef}
              value={values.startingLevel}
            >
              <option disabled value="">
                Select a starting point
              </option>
              <option value="new">New to interview practice</option>
              <option value="some">Some practice</option>
              <option value="reviewing">Reviewing familiar patterns</option>
            </select>
            <FieldError
              id="starting-level-error"
              messages={state.fieldErrors?.startingLevel}
            />
          </div>

          {state.formError ? (
            <p
              className={styles.formError}
              ref={formErrorRef}
              role="alert"
              tabIndex={-1}
            >
              {state.formError}
            </p>
          ) : null}

          <SubmitButton className={styles.submit} disabled={!isComplete}>
            Build my first session
          </SubmitButton>
        </form>
      </section>
    </div>
  );
}

function FieldError({
  id,
  messages,
}: Readonly<{ id: string; messages?: readonly string[] }>) {
  return messages?.[0] ? (
    <span className={styles.fieldError} id={id} role="alert">
      {messages[0]}
    </span>
  ) : null;
}
