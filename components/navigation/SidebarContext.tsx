"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// UX correction (Pre-Phase-5 Review, Priority 2): the sidebar has no
// responsive behavior on narrow viewports. This context is the minimal
// shared state needed for a hamburger toggle in `Header` to control the
// off-canvas `Sidebar`, without lifting either component out of
// `components/navigation` / `components/layout`.
interface SidebarContextValue {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <SidebarContext.Provider
      value={{ isOpen, toggle: () => setIsOpen((v) => !v), close: () => setIsOpen(false) }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within a SidebarProvider");
  return ctx;
}
