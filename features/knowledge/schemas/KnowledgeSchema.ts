import { z } from "zod";
import { KNOWLEDGE_STATUSES } from "@/constants/statuses";

// Document 7 §11. Document 10 §5.4 — field constraints. `category` is
// intentionally a free-form string (Document 13 §8) validated for shape
// here, not against a fixed enum — its *content* is checked by
// `GovernanceService.isAllowedCategory()` in the Service layer, not here
// (Zod validates shape; Governance validates business policy — Document 7
// §7 keeps those separate).
export const createKnowledgeSchema = z.object({
  title: z.string().trim().min(1, "title is required").max(300),
  summary: z.string().max(1000).optional(),
  markdown: z.string().min(1, "markdown is required"),
  projectId: z.string().uuid().optional(),
  category: z.string().trim().min(1, "category is required").max(100),
  confidence: z.number().min(0).max(1).optional(),
  status: z.enum(KNOWLEDGE_STATUSES).optional(),
});
export type CreateKnowledgeInput = z.infer<typeof createKnowledgeSchema>;

export const updateKnowledgeSchema = createKnowledgeSchema.partial();
export type UpdateKnowledgeInput = z.infer<typeof updateKnowledgeSchema>;
