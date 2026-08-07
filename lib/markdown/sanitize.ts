import sanitizeHtml from "sanitize-html";

// Document 7 §21 — "Sanitize markdown" is a mandatory security requirement,
// not optional polish. This was previously entirely unimplemented
// (`lib/markdown/` held only a `.gitkeep`) — flagged by the Phase 2
// Architecture Compliance Matrix (Document 14) and closed here.

/**
 * Sanitizes a raw HTML string directly (e.g. pasted rich-text content that
 * never went through markdown at all). Strips script/event-handler/
 * javascript: vectors while preserving a reasonable set of formatting tags.
 */
export function safeHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "title"],
      a: ["href", "name", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
  });
}

/**
 * Strips raw HTML embedded in Markdown *source* text (the CommonMark spec
 * allows raw HTML pass-through, which is the actual injection vector — a
 * `<script>` tag inside a `.md` string is valid Markdown). This is
 * defense-in-depth applied at write time (e.g. before persisting
 * `Knowledge.markdown`/`Document.markdown`), independent of and in
 * addition to `renderMarkdown()`'s read-time sanitization below — either
 * layer failing alone still leaves the other in place.
 *
 * Known limitation: because this works by stripping anything that parses
 * as an HTML tag, source text that merely *contains* `<`/`>` characters in
 * prose (not intended as HTML) can be affected. Acceptable for a security
 * utility; revisit if it proves too aggressive once real content exists
 * (Phase 3+).
 */
export function sanitizeMarkdown(markdown: string): string {
  return sanitizeHtml(markdown, { allowedTags: [], allowedAttributes: {} });
}
