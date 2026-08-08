import * as React from "react";
import { cn } from "@/lib/utils";

// shadcn/ui-style primitive — a native `<select>`, not Radix's Select. No
// extra dependency needed, and a native control gives keyboard/screen
// reader support for free (the user's Phase 4 usability criterion #5),
// which a hand-rolled listbox would have to reimplement from scratch.
const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export { Select };
