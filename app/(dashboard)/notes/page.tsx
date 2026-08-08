import { Suspense } from "react";
import { NotesView } from "@/features/notes/components/NotesView";

// Document 5 §3 — app/ contains routing only (Document 9 Phase 4).
// Suspense boundary required by Next.js because NotesView reads
// `useSearchParams()` (the Project cross-navigation filter, Priority 5).
export default function NotesPage() {
  return (
    <Suspense>
      <NotesView />
    </Suspense>
  );
}
