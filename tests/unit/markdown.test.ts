import { describe, expect, it } from "vitest";
import { renderMarkdown, safeHtml, sanitizeMarkdown } from "@/lib/markdown";

// Document 7 §21 — proving the sanitizer actually neutralizes known XSS
// vectors, not just that it compiles. Document 13 §16-19 (Infrastructure
// Hardening Sprint).

describe("sanitizeMarkdown", () => {
  it("strips a raw <script> tag embedded in markdown source", () => {
    const input = "# Title\n\n<script>alert('xss')</script>\n\nSome text.";
    const output = sanitizeMarkdown(input);
    expect(output).not.toContain("<script");
    expect(output).not.toContain("alert(");
  });

  it("strips an onerror event handler on a raw <img>", () => {
    const input = '<img src="x" onerror="alert(1)">';
    const output = sanitizeMarkdown(input);
    expect(output).not.toContain("onerror");
  });

  it("preserves plain text content", () => {
    const output = sanitizeMarkdown("Just plain text, no HTML here.");
    expect(output).toContain("Just plain text, no HTML here.");
  });
});

describe("safeHtml", () => {
  it("strips <script> tags", () => {
    const output = safeHtml("<p>hello</p><script>alert('xss')</script>");
    expect(output).not.toContain("<script");
    expect(output).toContain("<p>hello</p>");
  });

  it("strips javascript: URLs from links", () => {
    const output = safeHtml('<a href="javascript:alert(1)">click</a>');
    expect(output).not.toContain("javascript:");
  });

  it("strips inline event handlers", () => {
    const output = safeHtml('<div onclick="alert(1)">hi</div>');
    expect(output).not.toContain("onclick");
  });

  it("preserves an allowed img with a safe src", () => {
    const output = safeHtml('<img src="https://example.com/a.png" alt="a">');
    expect(output).toContain("https://example.com/a.png");
  });
});

describe("renderMarkdown", () => {
  it("renders a heading", async () => {
    const html = await renderMarkdown("# Hello World");
    expect(html).toContain("<h1>");
    expect(html).toContain("Hello World");
  });

  it("renders GFM tables (remark-gfm)", async () => {
    const html = await renderMarkdown("| A | B |\n|---|---|\n| 1 | 2 |");
    expect(html).toContain("<table>");
  });

  it("renders a fenced code block", async () => {
    const html = await renderMarkdown("```ts\nconst x = 1;\n```");
    expect(html).toContain("<pre>");
    expect(html).toContain("<code");
  });

  it("strips a raw <script> tag even though CommonMark allows raw HTML pass-through", async () => {
    const html = await renderMarkdown("# Title\n\n<script>alert('xss')</script>");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(");
  });

  it("strips an onerror handler on a raw <img> inside markdown", async () => {
    const html = await renderMarkdown('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain("onerror");
  });

  it("renders a safe link with its href intact", async () => {
    const html = await renderMarkdown("[KAIRO-Lite](https://example.com)");
    expect(html).toContain('href="https://example.com"');
  });
});
