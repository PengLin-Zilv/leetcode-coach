"use client";

import { useEffect } from "react";

export function ClearPracticeDraft({
  problemId,
}: Readonly<{ problemId: string }>) {
  useEffect(() => {
    window.localStorage.removeItem(`leetcode-coach:practice:${problemId}`);
  }, [problemId]);

  return null;
}
