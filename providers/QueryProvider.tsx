"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Document 5 §11 — TanStack Query client provider. Referenced by Document 5
// as `QueryProvider.tsx` but not named as a dependency anywhere in
// Documents 1-9; installed here as the implied client-state/data-fetching
// layer for future Feature hooks (`useProject`, `useKnowledge`, etc.).
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
