"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// shadcn/ui-style primitive, built on the native `<dialog>` element rather
// than Radix Dialog (no `@radix-ui/react-dialog` dependency is installed —
// see Document 9 Phase 4 report for why this wasn't added). The native
// element gives focus trapping, Escape-to-close, and a real backdrop for
// free, which satisfies the user's Phase 4 usability criterion #5
// (keyboard users can complete the primary workflow) without reimplementing
// any of it by hand.

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** Overrides the dialog box's max-width (defaults to `max-w-lg`) — e.g.
   * `"max-w-2xl"` for forms with a `MarkdownEditor`. */
  className?: string;
}

export function Dialog({ open, onOpenChange, children, className }: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) {
      node.showModal();
    } else if (!open && node.open) {
      node.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
      onClick={(event) => {
        // Clicking the backdrop (the ::backdrop-covered area outside the
        // dialog's own box) closes it — `event.target === dialogElement`
        // only when the click landed on the backdrop itself, since content
        // clicks land on a descendant.
        if (event.target === ref.current) {
          onOpenChange(false);
        }
      }}
      className={cn(
        "w-full max-w-lg rounded-lg border border-border bg-background p-0 text-foreground shadow-lg backdrop:bg-black/50",
        className,
      )}
    >
      {open ? children : null}
    </dialog>
  );
}

export function DialogContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("relative p-6", className)} {...props}>
      {children}
    </div>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 flex flex-col gap-1.5", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-6 flex justify-end gap-2", className)} {...props} />;
}

export function DialogCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close dialog"
      className="absolute right-4 top-4 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <X className="h-4 w-4" />
    </button>
  );
}
