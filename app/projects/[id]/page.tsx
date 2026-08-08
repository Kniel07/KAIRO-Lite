import { ProjectDetailView } from "@/features/projects/components/ProjectDetailView";

// Document 5 §3 — app/ contains routing only (Document 9 Phase 4).
export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectDetailView id={id} />;
}
