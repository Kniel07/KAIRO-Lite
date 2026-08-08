import { z } from "zod";
import { AI_MODES } from "@/constants/statuses";

// Document 8 §23 — AI Contract: "Every AI request must include: mode,
// prompt. Optional: projectId, conversationId, knowledgeIds." IMPLEMENT
// additionally accepts `approved` (Document 12 §6).
export const aiChatRequestSchema = z.object({
  mode: z.enum(AI_MODES),
  prompt: z.string().trim().min(1, "prompt is required").max(10_000),
  projectId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  knowledgeIds: z.array(z.string().uuid()).optional(),
  approved: z.boolean().optional(),
});
export type AIChatRequestInput = z.infer<typeof aiChatRequestSchema>;
