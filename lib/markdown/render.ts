import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

// Document 7 §21 — safe Markdown → HTML rendering. `rehype-sanitize` runs
// on the parsed HAST tree (structural, not string-based) before
// stringifying, so this is a second, independent sanitization layer from
// `sanitizeMarkdown()` in `sanitize.ts` — either one failing alone still
// leaves the other in place.
//
// This returns a sanitized HTML *string*, not a React element — it is a
// `lib/` function, not a component (Document 5 §5: components render,
// they don't own sanitization logic). A future `MarkdownViewer` component
// (Phase 4) would call this and pass the result to `dangerouslySetInnerHTML`
// — that component does not exist yet; this is infrastructure only.
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeStringify);

export async function renderMarkdown(markdown: string): Promise<string> {
  const result = await processor.process(markdown);
  return String(result);
}
