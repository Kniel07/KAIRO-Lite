"use client";

import { useEffect, useState } from "react";

// Document 5 §10 — "Hooks contain client-side behavior only." Generic
// utility, no business logic — safe to implement in Phase 1.
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
