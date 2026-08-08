import { cn } from "@/lib/utils";

// shadcn/ui-style primitive — loading-state placeholder (Document 9 Phase
// 4 deliverable: "Loading states"). `aria-hidden` since it conveys no
// information itself; the loading state's meaning belongs on a
// surrounding element with `aria-busy`/`role="status"`.
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
