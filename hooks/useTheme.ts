"use client";

// Document 5 §10 / Document 5 §11 — re-exported so app code imports theme
// behavior from the project's own hooks namespace (`@/hooks/useTheme`)
// rather than reaching into `next-themes` directly throughout the app.
export { useTheme } from "next-themes";
