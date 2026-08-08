import type { ReactNode } from "react";

// Document 9 Phase 4 deliverable: "Empty states." The user's usability
// criterion #3 — "is the empty state helpful rather than blank" — is the
// entire reason this exists as a shared component instead of every page
// writing its own ad hoc blank-div fallback: every list view gets an
// explanation and a primary action, not silence.
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-10 text-center">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
