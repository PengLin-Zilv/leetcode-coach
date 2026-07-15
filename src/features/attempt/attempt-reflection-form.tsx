"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  submitAttemptReflectionAction,
  type AttemptReflectionActionState,
} from "../../app/practice/[problemId]/reflection/actions.server";
import { SubmitButton } from "../../components/submit-button";
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
}: Readonly<{
  highestHintLevel: number;
  problemId: string;
  problemTitle: string;
}>) {
  const submit = submitAttemptReflectionAction.bind(null, problemId);
  const [state, action] = useActionState(submit, INITIAL_STATE);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const storageKey = `leetcode-coach:practice:${problemId}`;

  useEffect(() => {
    if (noteRef.current !== null) {
      noteRef.current.value = window.localStorage.getItem(storageKey) ?? "";
    }
  }, [storageKey]);

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="reflection-title">
        <p className={styles.eyebrow}>Session reflection</p>
        <h1 id="reflection-title">Finish attempt</h1>
        <p className={styles.intro}>
          Record what happened on {problemTitle}. This takes less than 30
          seconds.
        </p>

        <form action={action} className={styles.form}>
          <fieldset className={styles.fieldset}>
            <legend>Result</legend>
            <div className={styles.resultOptions}>
              {resultOptions.map(({ label, value }) => (
                <label className={styles.resultOption} key={value}>
                  <input name="result" required type="radio" value={value} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <FieldError messages={state.fieldErrors?.result} />
            <p className={styles.evidenceNote}>
              A solved result counts as independent only when the server-owned
              hint depth is zero. This session recorded hint depth{" "}
              {highestHintLevel}.
            </p>
          </fieldset>

          <div className={styles.field}>
            <label htmlFor="confidence">Confidence</label>
            <select defaultValue="" id="confidence" name="confidence">
              <option value="">Optional</option>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <FieldError messages={state.fieldErrors?.confidence} />
          </div>

          <div className={styles.field}>
            <label htmlFor="attempt-note">Optional note</label>
            <textarea
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
            <FieldError messages={state.fieldErrors?.note} />
          </div>

          {state.formError ? (
            <p className={styles.formError} role="alert">
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

function FieldError({ messages }: Readonly<{ messages?: readonly string[] }>) {
  return messages?.[0] ? (
    <span className={styles.fieldError}>{messages[0]}</span>
  ) : null;
}
