"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  requestHintAction,
  type HintActionResult,
} from "../../app/practice/[problemId]/actions.server";
import type { Pattern, Problem } from "../training/training-repository";
import type { ActivePractice } from "./active-practice";
import styles from "./practice-session.module.css";

type PresentationMode = "simpler" | "example" | "trace";

const presentationControls = [
  { label: "Simpler", mode: "simpler" },
  { label: "Example", mode: "example" },
  { label: "Trace it", mode: "trace" },
] as const satisfies readonly {
  label: string;
  mode: PresentationMode;
}[];

export function PracticeSession({
  active,
  pattern,
  problem,
}: Readonly<{
  active: ActivePractice;
  pattern: Pattern;
  problem: Problem;
}>) {
  const storageKey = `leetcode-coach:practice:${problem.id}:${active.startedAt}`;
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const notesValueRef = useRef("");
  const openMindButtonRef = useRef<HTMLButtonElement>(null);
  const closeMindButtonRef = useRef<HTMLButtonElement>(null);
  const wasMindOpenRef = useRef(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hintResult, setHintResult] = useState<HintActionResult | null>(null);
  const [presentationMode, setPresentationMode] =
    useState<PresentationMode>("simpler");
  const [mindOpen, setMindOpen] = useState(false);
  const [isRequestingHint, startHintRequest] = useTransition();

  useEffect(() => {
    const restoredNotes = window.localStorage.getItem(storageKey) ?? "";
    notesValueRef.current = restoredNotes;

    if (notesRef.current !== null) {
      notesRef.current.value = restoredNotes;
    }
  }, [storageKey]);

  useEffect(() => {
    const startedAt = Date.parse(active.startedAt);
    const updateElapsed = () => {
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - startedAt) / 1_000)),
      );
    };

    updateElapsed();
    const interval = window.setInterval(updateElapsed, 1_000);

    return () => window.clearInterval(interval);
  }, [active.startedAt]);

  useEffect(() => {
    if (mindOpen) {
      closeMindButtonRef.current?.focus();
    } else if (wasMindOpenRef.current) {
      openMindButtonRef.current?.focus();
    }

    wasMindOpenRef.current = mindOpen;
  }, [mindOpen]);

  function requestHint(): void {
    startHintRequest(async () => {
      const result = await requestHintAction({
        problemId: problem.id,
        attemptSummary:
          notesValueRef.current.trim() || "No attempt notes yet.",
      });
      setHintResult(result);
    });
  }

  const hintDepth =
    hintResult?.status === "hint"
      ? hintResult.hintLevel
      : active.highestHintLevel;

  return (
    <div className={styles.sessionShell}>
      <header className={styles.topBar}>
        <Link className={styles.backLink} href="/today">
          ← Today
        </Link>
        <div className={styles.sessionIdentity}>
          <span>{problem.title}</span>
          <span>{pattern.name}</span>
        </div>
        <span className={styles.timer} role="timer" aria-label="Elapsed time">
          {formatElapsed(elapsedSeconds)}
        </span>
        <Link
          aria-disabled="false"
          className={styles.endAction}
          href={`/practice/${problem.id}/reflection`}
        >
          End attempt
        </Link>
      </header>

      <main className={styles.layout}>
        <section className={styles.practicePane} aria-labelledby="practice-title">
          <p className={styles.eyebrow}>Practice</p>
          <p className={styles.pattern}>{pattern.name}</p>
          <h1 id="practice-title">{problem.title}</h1>
          <p className={styles.target}>{problem.estimatedMinutes} minute target</p>

          <div className={styles.goal}>
            <h2>Goal</h2>
            <p>
              Work toward an independent solution and write down the invariant
              that makes your approach correct.
            </p>
          </div>

          <a
            className={styles.problemLink}
            href={problem.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            Open problem on LeetCode
          </a>

          <label className={styles.notesLabel} htmlFor="practice-notes">
            Notes
          </label>
          <textarea
            id="practice-notes"
            className={styles.notes}
            defaultValue=""
            onChange={(event) => {
              notesValueRef.current = event.target.value;
              window.localStorage.setItem(storageKey, event.target.value);
            }}
            placeholder="Capture your approach, edge cases, or invariant."
            ref={notesRef}
          />
          <p className={styles.focusCue}>
            Focus cue: explain what your data structure remembers before coding.
          </p>

          <button
            className={styles.openMindButton}
            onClick={() => setMindOpen(true)}
            ref={openMindButtonRef}
            type="button"
          >
            Open coaching
          </button>
        </section>

        <aside
          aria-labelledby="mind-title"
          aria-modal={mindOpen ? "true" : undefined}
          className={`${styles.mindPanel} ${mindOpen ? styles.mindPanelOpen : ""}`}
          role={mindOpen ? "dialog" : undefined}
        >
          <div className={styles.mindHeader}>
            <h2 id="mind-title">MIND</h2>
            <button
              aria-label="Close coaching"
              className={styles.closeMindButton}
              onClick={() => setMindOpen(false)}
              ref={closeMindButtonRef}
              type="button"
            >
              Close
            </button>
          </div>

          <p className={styles.mindPrompt}>What have you tried so far?</p>
          <p className={styles.hintDepth}>Hint depth: {hintDepth} of 4</p>

          {hintResult?.status === "unavailable" ? (
            <p className={styles.unavailable} role="status">
              {hintResult.message}
            </p>
          ) : null}
          {hintResult?.status === "hint" ? (
            <p className={styles.hint} role="status">
              {hintResult.body}
            </p>
          ) : null}

          <button
            className={styles.hintButton}
            disabled={isRequestingHint || hintDepth === 4}
            onClick={requestHint}
            type="button"
          >
            {isRequestingHint ? "Checking coaching…" : "Give me a hint"}
          </button>

          <div className={styles.presentationControls} aria-label="Hint format">
            {presentationControls.map(({ label, mode }) => (
              <button
                aria-pressed={presentationMode === mode}
                key={mode}
                onClick={() => setPresentationMode(mode)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <p className={styles.presentationNote}>
            Format controls change how help is shown, not how much is revealed.
          </p>
        </aside>
      </main>
    </div>
  );
}

function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}
