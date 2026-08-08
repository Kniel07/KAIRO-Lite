import * as React from "react";
import { cn } from "@/lib/utils";

// shadcn/ui-style primitive. A plain `<label>`, not Radix's — no extra
// dependency needed for a static text/for association, and this is the
// one piece keyboard/screen-reader users need for every form field (the
// user's Phase 4 usability criterion #5).
const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  ),
);
Label.displayName = "Label";

export { Label };
