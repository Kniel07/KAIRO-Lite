// Document 10 §5.11 — Theme enum values, consumed by next-themes
// (providers/ThemeProvider.tsx) and Settings (Phase 3+).

export const THEMES = ["LIGHT", "DARK", "SYSTEM"] as const;

export type ThemeValue = (typeof THEMES)[number];
