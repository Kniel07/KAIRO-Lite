import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Required by shadcn/ui (Document 9, Phase 0 — "Configure shadcn/ui").
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
