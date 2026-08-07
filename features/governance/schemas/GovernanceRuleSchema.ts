import { z } from "zod";

// Document 7 §11. Document 10 §5.12 — key-value config, `value` is JSON.
// The nested/top-level split below mirrors Prisma's own
// `InputJsonValue`/`InputJsonObject` distinction exactly
// (`node_modules/@prisma/client/runtime/client.d.ts`): `null` is a valid
// *nested* value but not a valid *top-level* one — Prisma requires the
// dedicated `Prisma.JsonNull` marker for that case, which a Service may
// not import (Document 7 §8). Typing `value` as `JsonValue` (not
// `unknown`) lets `GovernanceService.set()` pass it straight to
// `GovernanceRuleRepositoryLike.upsert()` (typed `Prisma.InputJsonValue`)
// and have TypeScript check the assignment structurally.
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const topLevelJsonValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(jsonValueSchema),
  z.record(z.string(), jsonValueSchema),
]);

export const setGovernanceRuleSchema = z.object({
  key: z.string().trim().min(1, "key is required").max(200),
  value: topLevelJsonValueSchema,
  description: z.string().max(1000).optional(),
});
export type SetGovernanceRuleInput = z.infer<typeof setGovernanceRuleSchema>;
