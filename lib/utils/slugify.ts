// Document 5 §7 — lib/utils example (`slugify.ts`). Used by `ProjectService`
// to derive `Project.slug` (Document 10 §5.2, unique) from `Project.name`.
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics left behind by NFKD
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
