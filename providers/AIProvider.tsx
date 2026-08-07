"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { AIMode } from "@/types/ai";

// Document 5 §11 — client-side AI Workspace context. Distinct from
// `@/ai/providers/AIProvider` (Document 4 §7's server-side LLM provider
// interface) — same name in Document 5, different responsibility and path.
//
// TODO(Document 4, Document 12; Phase 5 — AI Layer): wire this to the
// `/api/v1/ai/chat` endpoint and the AI Workspace UI (Phase 4/5). The
// context shape below is a skeleton only — no AI prompts yet.

interface AIWorkspaceContextValue {
  activeMode: AIMode | null;
}

const AIWorkspaceContext = createContext<AIWorkspaceContextValue | null>(null);

export function AIProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AIWorkspaceContextValue>(() => ({ activeMode: null }), []);

  return <AIWorkspaceContext.Provider value={value}>{children}</AIWorkspaceContext.Provider>;
}

export function useAIWorkspace(): AIWorkspaceContextValue {
  const context = useContext(AIWorkspaceContext);
  if (!context) {
    throw new Error("useAIWorkspace must be used within an AIProvider");
  }
  return context;
}
