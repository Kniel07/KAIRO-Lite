import {
  LayoutDashboard,
  FolderKanban,
  BookOpen,
  StickyNote,
  FileText,
  Sparkles,
  Search,
  Settings,
} from "lucide-react";
import type { ReactNode } from "react";
import { ROUTES } from "@/constants/routes";
import { NavLink } from "@/components/navigation/NavLink";
import { Header } from "@/components/layout/Header";

// Document 5 §3 — application shell (Document 9 Phase 4: "Navigation",
// "Layout"). No business logic, no data fetching here — that lives in each
// page's own Client Components via the feature hooks.
//
// Icons are pre-rendered elements, not component references — see
// `NavLink`'s header comment for why (Server → Client Component prop
// serialization).
const ICON_CLASS = "h-4 w-4";
const NAV_ITEMS: { href: string; label: string; icon: ReactNode }[] = [
  {
    href: ROUTES.home,
    label: "Dashboard",
    icon: <LayoutDashboard className={ICON_CLASS} aria-hidden="true" />,
  },
  {
    href: ROUTES.projects,
    label: "Projects",
    icon: <FolderKanban className={ICON_CLASS} aria-hidden="true" />,
  },
  {
    href: ROUTES.knowledge,
    label: "Knowledge",
    icon: <BookOpen className={ICON_CLASS} aria-hidden="true" />,
  },
  {
    href: ROUTES.notes,
    label: "Notes",
    icon: <StickyNote className={ICON_CLASS} aria-hidden="true" />,
  },
  {
    href: ROUTES.documents,
    label: "Documents",
    icon: <FileText className={ICON_CLASS} aria-hidden="true" />,
  },
  {
    href: ROUTES.ai,
    label: "AI Workspace",
    icon: <Sparkles className={ICON_CLASS} aria-hidden="true" />,
  },
  {
    href: ROUTES.search,
    label: "Search",
    icon: <Search className={ICON_CLASS} aria-hidden="true" />,
  },
  {
    href: ROUTES.settings,
    label: "Settings",
    icon: <Settings className={ICON_CLASS} aria-hidden="true" />,
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:bg-background focus:p-2 focus:shadow-lg"
      >
        Skip to main content
      </a>
      <aside className="w-56 shrink-0 border-r border-border p-4">
        <div className="mb-6 text-lg font-semibold">KAIRO-Lite</div>
        <nav aria-label="Main navigation" className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <Header />
        <main id="main-content" className="flex flex-1 flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
