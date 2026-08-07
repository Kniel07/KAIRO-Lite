import Link from "next/link";
import { ROUTES } from "@/constants/routes";

// Document 5 §3 — application shell only (Document 9, Phase 0 scope). No
// business logic, no data fetching — navigation chrome for the routes that
// later phases will fill in.
const NAV_ITEMS: { href: string; label: string }[] = [
  { href: ROUTES.home, label: "Dashboard" },
  { href: ROUTES.projects, label: "Projects" },
  { href: ROUTES.knowledge, label: "Knowledge" },
  { href: ROUTES.notes, label: "Notes" },
  { href: ROUTES.documents, label: "Documents" },
  { href: ROUTES.ai, label: "AI Workspace" },
  { href: ROUTES.search, label: "Search" },
  { href: ROUTES.settings, label: "Settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-border p-4">
        <div className="mb-6 text-lg font-semibold">KAIRO-Lite</div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
