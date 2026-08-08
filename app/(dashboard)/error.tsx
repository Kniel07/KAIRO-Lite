"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/feedback/ErrorState";

// Next.js error boundary convention file. Document 9 Phase 4 deliverable:
// "Error boundaries." Scoped to the `(dashboard)` segment so a page-level
// crash shows this in the content area while the sidebar/header (this
// segment's own `layout.tsx`) stays mounted — the user never loses
// navigation because one page broke.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Document 7 §10 — never swallow errors; this is the last line of
    // defense before a user-visible crash, so it's logged even though the
    // UI itself takes over from here.
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-md">
        <ErrorState
          title="This page ran into a problem"
          message={error.message || "An unexpected error occurred."}
          onRetry={reset}
        />
      </div>
    </div>
  );
}
