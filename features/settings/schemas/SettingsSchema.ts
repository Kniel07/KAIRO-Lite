import { z } from "zod";
import { THEMES } from "@/constants/themes";

// Document 7 §11. Document 10 §5.11 — field constraints. No `userId` field
// here — the owner is always `ServiceContext.userId`, never client-supplied
// (Document 11 §7).
export const updateSettingsSchema = z.object({
  theme: z.enum(THEMES).optional(),
  defaultModel: z.string().trim().min(1).max(100).optional(),
  aiTemperature: z.number().min(0).max(2).optional(),
  language: z.string().trim().min(2).max(10).optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
