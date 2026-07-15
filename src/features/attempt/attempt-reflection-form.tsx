"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  submitAttemptReflectionAction,
  type AttemptReflectionActionState,
} from "../../app/practice/[problemId]/reflection/actions.server";
import { SubmitButton } from "../../components/submit-button";
import { practiceDraftStorageKey } from "../practice/active-practice";
import styles from "./attempt-reflection-form.module.css";

const INITIAL_STATE: AttemptReflectionActionState = {};

const resultOptions = [
  { label: "Solved", value: "solved" },
  { label: "Not solved yet", value: "not_solved" },
  { label: "Viewed solution", value: "viewed_solution" },
] as const;

export function AttemptReflectionForm({
  highestHintLevel,
  problemId,
  problemTitle,
  startedAt,
}: Readonly<{
  highestHintLevel: number;
  problemId: string;
  problemTitle: string;
  startedAt: string;
}>) {
  const submit = submitAttemptReflectionAction.bind(null, problemId);
  const [state, action] = useActionState(submit, INITIAL_STATE);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const firstResultRef = useRef<HTMLInputElement>(null);
  const confidenceRef = useRef<HTMLSelectElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);
  const storageKey = practiceDraftStorageKey(problemId, startedAt);

  useEffect(() => {
    if (noteRef.current !== null) {
      noteRef.current.value = window.localStorage.getItem(storageKey) ?? "";
    }
  }, [storageKey]);

  useEffect(() => {
    const firstInvalid = state.fieldErrors?.result?.[0]
      ? firstResultRef.current
      : state.fieldErrors?.confidence?.[0]
        ? confidenceRef.current
        : state.fieldErrors?.note?.[0]
          ? noteRef.current
          : null;
    (firstInvalid ?? (state.formError ? formErrorRef.current : null))?.focus();
  }, [state]);

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="reflection-title">
        <p className={styles.eyebrow}>Session reflection</p>
        <h1 id="reflection-title">Finish attempt</h1>
        <p className={styles.intro}>
          Record what happened on {problemTitle}. This takes less than 30
          seconds.
        </p>

        <form action={action} className={styles.form} noValidate>
          <fieldset className={styles.fieldset}>
            <legend>Result</legend>
            <div className={styles.resultOptions}>
              {resultOptions.map(({ label, value }) => (
                <label className={styles.resultOption} key={value}>
                  <input
                    aria-describedby={
                      state.fieldErrors?.result ? "result-error" : undefined
                    }
                    name="result"
                    ref={value === "solved" ? firstResultRef : undefined}
                    required
                    type="radio"
                    value={value}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <FieldError
              id="result-error"
              messages={state.fieldErrors?.result}
            />
            <p className={styles.evidenceNote}>
              A solved result counts as independent only when the server-owned
              hint depth is zero. This session recorded hint depth{" "}
              {highestHintLevel}.
            </p>
          </fieldset>

          <div className={styles.field}>
            <label htmlFor="confidence">Confidence</label>
            <select
              aria-describedby={
                state.fieldErrors?.confidence ? "confidence-error" : undefined
              }
              aria-invalid={Boolean(state.fieldErrors?.confidence)}
              defaultValue=""
              id="confidence"
              name="confidence"
              ref={confidenceRef}
            >
              <option value="">Optional</option>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <FieldError
              id="confidence-error"
              messages={state.fieldErrors?.confidence}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="attempt-note">Optional note</label>
            <textarea
              aria-describedby={
                state.fieldErrors?.note ? "attempt-note-error" : undefined
              }
              aria-invalid={Boolean(state.fieldErrors?.note)}
              defaultValue=""
              id="attempt-note"
              maxLength={2_000}
              name="note"
              onChange={(event) => {
                window.localStorage.setItem(storageKey, event.target.value);
              }}
              placeholder="What approach or invariant did you use?"
              ref={noteRef}
            />
            <FieldError
              id="attempt-note-error"
              messages={state.fieldErrors?.note}
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

          <SubmitButton className={styles.submit}>
            Review this attempt
          </SubmitButton>
        </form>
      </section>
    </main>
  );
}

function FieldError({
  id,
  messages,
}: Readonly<{ id?: string; messages?: readonly string[] }>) {
  return messages?.[0] ? (
    <span className={styles.fieldError} id={id} role="alert">
      {messages[0]}
    </span>
  ) : null;
}
