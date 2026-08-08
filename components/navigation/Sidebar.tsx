"use client";

import type { ReactNode } from "react";
import { NavLink } from "@/components/navigation/NavLink";
import { useSidebar } from "@/components/navigation/SidebarContext";

// UX correction (Pre-Phase-5 Review, Priority 2): below `md`, the sidebar
// becomes an off-canvas panel toggled by `Header`'s hamburger button
// instead of a fixed 224px column competing with page content for width.
export function Sidebar({ items }: { items: { href: string; label: string; icon: ReactNode }[] }) {
  const { isOpen, close } = useSidebar();

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={close}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-56 shrink-0 -translate-x-full border-r border-border bg-background p-4 transition-transform duration-200 md:static md:z-0 md:translate-x-0 ${
          isOpen ? "translate-x-0" : ""
        }`}
      >
        <div className="mb-6 text-lg font-semibold">KAIRO-Lite</div>
        <nav aria-label="Main navigation" className="flex flex-col gap-1">
          {items.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              onNavigate={close}
            />
          ))}
        </nav>
      </aside>
    </>
  );
}
