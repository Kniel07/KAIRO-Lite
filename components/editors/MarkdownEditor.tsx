"use client";

import { useEffect, useState } from "react";
import { renderMarkdown } from "@/lib/markdown/render";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Document 9 Phase 4 — "Markdown editing must use the existing markdown
// infrastructure": this calls `renderMarkdown()` (`lib/markdown/render.ts`,
// built in the Infrastructure Hardening Sprint), not a new rendering path.
// Used by Knowledge and Document forms (both have a `markdown` field);
// Notes deliberately do not use this — `Note.content` is plain text, not
// markdown (Document 10 §5.3 names the field `content`, not `markdown`).
export function MarkdownEditor({
  id,
  value,
  onChange,
  rows = 12,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [html, setHtml] = useState("");
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    if (tab !== "preview") return;
    let cancelled = false;
    setIsRendering(true);
    void renderMarkdown(value.trim() || "*Nothing to preview yet.*").then((result) => {
      if (!cancelled) {
        setHtml(result);
        setIsRendering(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tab, value]);

  return (
    <div className="flex flex-col gap-2">
      <div
        role="tablist"
        aria-label="Markdown editor mode"
        className="flex gap-1 border-b border-border"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "write"}
          onClick={() => setTab("write")}
          className={cn(
            "px-3 py-1.5 text-sm transition-colors",
            tab === "write"
              ? "border-b-2 border-primary font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Write
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "preview"}
          onClick={() => setTab("preview")}
          className={cn(
            "px-3 py-1.5 text-sm transition-colors",
            tab === "preview"
              ? "border-b-2 border-primary font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Preview
        </button>
      </div>

      {tab === "write" ? (
        <Textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={rows}
          className="font-mono text-sm"
          placeholder="Write Markdown…"
        />
      ) : (
        <div
          role="tabpanel"
          className="min-h-[8rem] rounded-md border border-input p-3 text-sm [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
        >
          {isRendering ? (
            <span className="text-muted-foreground">Rendering…</span>
          ) : (
            // Document 7 §21 — `html` is the output of `renderMarkdown()`,
            // already sanitized by `rehype-sanitize` before this component
            // ever sees it. No unsanitized value reaches
            // `dangerouslySetInnerHTML` here.
            <div dangerouslySetInnerHTML={{ __html: html }} />
          )}
        </div>
      )}
    </div>
  );
}
