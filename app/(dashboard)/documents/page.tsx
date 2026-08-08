import { Suspense } from "react";
import { DocumentsView } from "@/features/documents/components/DocumentsView";

// Document 5 §3 — app/ contains routing only (Document 9 Phase 4).
// Suspense boundary required by Next.js because DocumentsView reads
// `useSearchParams()` (the Project cross-navigation filter, Priority 5).
export default function DocumentsPage() {
  return (
    <Suspense>
      <DocumentsView />
    </Suspense>
  );
}
