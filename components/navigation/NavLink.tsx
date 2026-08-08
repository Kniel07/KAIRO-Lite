"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Document 9 Phase 4 deliverable: "Navigation." Active-route highlighting
// so a first-time user can always tell where they are (usability
// criterion #1) — a plain, unstyled nav list doesn't answer that.
//
// `icon` is a rendered element (`<FolderKanban className="h-4 w-4" />`),
// not a component reference — the caller (`(dashboard)/layout.tsx`, a
// Server Component) can't pass a raw `LucideIcon` function down to this
// Client Component across the server/client boundary (React can't
// serialize a function reference), but an already-resolved element is a
// plain serializable object.
export function NavLink({
  href,
  label,
  icon,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
        isActive
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
