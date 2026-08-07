// Document 5 §3 — route segments mirrored as typed constants so nothing in
// the app hardcodes a path string.

export const ROUTES = {
  home: "/",
  signIn: "/auth/signin",
  projects: "/projects",
  knowledge: "/knowledge",
  notes: "/notes",
  documents: "/documents",
  ai: "/ai",
  search: "/search",
  settings: "/settings",
} as const;
