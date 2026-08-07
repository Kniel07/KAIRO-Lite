// Document 10 §5.1 / Document 13 §7 (Amendment 6) — canonical UserRole
// values, mirrored from the Prisma enum for use outside the generated client
// (e.g. in Zod schemas before Phase 2's Services exist).

export const USER_ROLES = ["OWNER", "MEMBER"] as const;

export type UserRoleValue = (typeof USER_ROLES)[number];
