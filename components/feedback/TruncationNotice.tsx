// UX correction (Pre-Phase-5 Review, Priority 6): every list fetches a
// flat `pageSize=100` and silently dropped anything past it. This surfaces
// that instead of hiding it — a full pager is out of scope for current
// expected data volumes (Document 9 Phase 4 MVP), but silent truncation
// isn't acceptable either.
export function TruncationNotice({ shown, total }: { shown: number; total: number }) {
  if (total <= shown) return null;

  return (
    <p role="status" className="text-sm text-muted-foreground">
      Showing the first {shown} of {total}. Narrow your results to see the rest.
    </p>
  );
}
