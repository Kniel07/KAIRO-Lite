"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";
import { useSearchKnowledge } from "@/features/search/hooks/useSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/feedback/Spinner";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { ROUTES } from "@/constants/routes";

// Document 9 Phase 4 — Search: full-text only (Document 13 §2, Amendment
// 1 — no semantic search, no embeddings). One explicit action (submit a
// query) rather than search-as-you-type, so the loading/empty/error
// states are unambiguous and results aren't refetched on every keystroke.
export function SearchView() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const search = useSearchKnowledge();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;
    setSubmittedQuery(query.trim());
    search.mutate({ query: query.trim() });
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Search</h1>
        <p className="text-sm text-muted-foreground">
          Full-text search across your Knowledge base.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex max-w-xl items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="search-query" className="sr-only">
            Search query
          </Label>
          <Input
            id="search-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search knowledge…"
            autoFocus
          />
        </div>
        <Button type="submit" disabled={search.isPending || !query.trim()}>
          {search.isPending ? (
            <Spinner label="Searching" className="mr-2" />
          ) : (
            <SearchIcon className="mr-2 h-4 w-4" />
          )}
          Search
        </Button>
      </form>

      {search.isError ? (
        <ErrorState
          message="Search failed."
          onRetry={() => search.mutate({ query: submittedQuery })}
        />
      ) : search.isSuccess && search.data.items.length === 0 ? (
        <EmptyState
          title={`No results for "${submittedQuery}"`}
          description="Try a different or shorter query, or check the Knowledge page directly."
          action={
            <Link href={ROUTES.knowledge} className="text-sm font-medium underline">
              Browse all Knowledge
            </Link>
          }
        />
      ) : search.isSuccess ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {search.data.meta?.total ?? search.data.items.length} result
            {(search.data.meta?.total ?? search.data.items.length) === 1 ? "" : "s"} for &quot;
            {submittedQuery}&quot;
          </p>
          {search.data.items.map((result) => (
            <Card key={result.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium">{result.title}</h3>
                    {result.summary ? (
                      <p className="mt-1 text-sm text-muted-foreground">{result.summary}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    rank {result.rank.toFixed(3)}
                  </span>
                </div>
                <Link
                  href={`${ROUTES.knowledge}?open=${result.id}`}
                  className="mt-2 inline-block text-sm text-primary hover:underline"
                >
                  Open in Knowledge →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
