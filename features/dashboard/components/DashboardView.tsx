"use client";

import Link from "next/link";
import { Plus, FolderKanban, BookOpen, StickyNote } from "lucide-react";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { useKnowledgeList } from "@/features/knowledge/hooks/useKnowledge";
import { useNotes } from "@/features/notes/hooks/useNotes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { ROUTES } from "@/constants/routes";

// Document 9 Phase 4 — Dashboard: overview aggregating Projects/Knowledge/
// Notes via the same Route Handlers each dedicated page uses (no separate
// dashboard API — Document 8 has no dashboard resource to call). A Client
// Component (data fetching via the feature hooks); `app/(dashboard)/page.tsx`
// stays a thin routing shell per Document 5 §3.

function StatCard({
  href,
  icon,
  label,
  count,
  isLoading,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  count: number | undefined;
  isLoading: boolean;
}) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardContent className="flex items-center gap-4 p-6">
          <div className="rounded-md bg-primary/10 p-2 text-primary">{icon}</div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            {isLoading ? (
              <Skeleton className="h-7 w-10" />
            ) : (
              <p className="text-2xl font-semibold">{count ?? 0}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function DashboardView() {
  const projects = useProjects();
  const knowledge = useKnowledgeList();
  const notes = useNotes();

  const recentProjects = [...(projects.data?.items ?? [])]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            An overview of your projects, knowledge, and notes.
          </p>
        </div>
        <Link href={ROUTES.projects} className={buttonVariants()}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          href={ROUTES.projects}
          icon={<FolderKanban className="h-5 w-5" aria-hidden="true" />}
          label="Projects"
          count={projects.data?.meta?.total}
          isLoading={projects.isPending}
        />
        <StatCard
          href={ROUTES.knowledge}
          icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
          label="Knowledge"
          count={knowledge.data?.meta?.total}
          isLoading={knowledge.isPending}
        />
        <StatCard
          href={ROUTES.notes}
          icon={<StickyNote className="h-5 w-5" aria-hidden="true" />}
          label="Notes"
          count={notes.data?.meta?.total}
          isLoading={notes.isPending}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {projects.isPending ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : projects.isError ? (
            <ErrorState message="Couldn't load projects." onRetry={() => void projects.refetch()} />
          ) : recentProjects.length === 0 ? (
            <EmptyState
              title="No projects yet"
              description="Projects organize your knowledge, notes, and documents. Create your first one to get started."
              action={
                <Link href={ROUTES.projects} className={buttonVariants({ size: "sm" })}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Project
                </Link>
              }
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {recentProjects.map((project) => (
                <li key={project.id} className="flex items-center justify-between py-3">
                  <Link
                    href={`${ROUTES.projects}/${project.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {project.name}
                  </Link>
                  <Badge variant="secondary">{project.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
