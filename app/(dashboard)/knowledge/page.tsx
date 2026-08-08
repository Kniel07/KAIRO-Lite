import { Suspense } from "react";
import { KnowledgeView } from "@/features/knowledge/components/KnowledgeView";

// Document 5 §3 — app/ contains routing only (Document 9 Phase 4).
// Suspense boundary required by Next.js because KnowledgeView reads
// `useSearchParams()` (the Search-result deep-link, Priority 4 UX fix).
export default function KnowledgePage() {
  return (
    <Suspense>
      <KnowledgeView />
    </Suspense>
  );
}
