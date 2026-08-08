// UX correction (Pre-Phase-5 Review, Priority 8): no form indicated which
// fields were required before submission — a user only found out after
// submitting. Paired with each form's "* Required" legend.
export function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      {" "}
      *
    </span>
  );
}
