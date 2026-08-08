import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Document 9 Phase 4 deliverable: "Loading states." The user's usability
// criterion #4 — "does every long-running action provide feedback" — this
// is the feedback primitive every form/button/table uses for it.
// `role="status"` + `sr-only` text so screen-reader users get the same
// feedback sighted users get from the animation.
export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2">
      <Loader2 className={cn("h-4 w-4 animate-spin", className)} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
