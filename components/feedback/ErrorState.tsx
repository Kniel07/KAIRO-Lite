import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

// Document 9 Phase 4 deliverable: "Error boundaries." The user's usability
// criterion #6 — "are error messages actionable" — drives the shape here:
// every error state gets a retry action, not just a message, whenever a
// retry makes sense (data-fetch failures always do; the caller omits
// `onRetry` for one-shot actions where it wouldn't).
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <span>{message}</span>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry} className="w-fit">
            Try again
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
