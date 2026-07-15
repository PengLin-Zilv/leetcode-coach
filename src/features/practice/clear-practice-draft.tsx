"use client";

import { useEffect } from "react";

export function ClearPracticeDraft({
  storageKey,
}: Readonly<{ storageKey: string }>) {
  useEffect(() => {
    window.localStorage.removeItem(storageKey);
  }, [storageKey]);

  return null;
}
