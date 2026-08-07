import { z } from "zod";
import { PROJECT_PRIORITIES, PROJECT_STATUSES, PROJECT_VISIBILITIES } from "@/constants/statuses";

// Document 7 §11 — "All external input must be validated ... using Zod."
// Document 10 §5.2 — field constraints.
export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(200),
  description: z.string().max(5000).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  priority: z.enum(PROJECT_PRIORITIES).optional(),
  visibility: z.enum(PROJECT_VISIBILITIES).optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema.partial();
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
