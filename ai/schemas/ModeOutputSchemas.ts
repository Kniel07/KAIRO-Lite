import { z } from "zod";

// Document 12 §3-6 — the exact Output Schema table for each mode (+
// IMPLEMENT's two stages). `.strict()` on every object here is what
// enforces Document 12 §7 check 5, "role compliance" — e.g. a THINK
// response containing a `files` array is rejected as a schema failure
// even though it would otherwise be valid JSON, because `.strict()` fails
// on any key the schema doesn't declare. This is the mechanical
// enforcement of "cross-mode leakage is treated as a schema failure."

export const thinkOutputSchema = z
  .object({
    ideas: z
      .array(
        z
          .object({
            title: z.string().min(1),
            description: z.string().min(1),
            assumptions: z.array(z.string()),
            tradeoffs: z.array(z.string()),
          })
          .strict(),
      )
      .min(1),
    openQuestions: z.array(z.string()),
  })
  .strict();
export type ThinkOutput = z.infer<typeof thinkOutputSchema>;

export const validateOutputSchema = z
  .object({
    issues: z.array(
      z
        .object({
          severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
          description: z.string().min(1),
          location: z.string(),
          recommendation: z.string().min(1),
        })
        .strict(),
    ),
    risks: z.array(z.string()),
    missingRequirements: z.array(z.string()),
    verdict: z.enum(["PASS", "NEEDS_REVISION", "BLOCKED"]),
  })
  .strict();
export type ValidateOutput = z.infer<typeof validateOutputSchema>;

export const documentOutputSchema = z
  .object({
    title: z.string().min(1),
    sections: z
      .array(
        z
          .object({
            heading: z.string().min(1),
            content: z.string(),
          })
          .strict(),
      )
      .min(1),
    format: z.literal("markdown"),
    incompleteSections: z.array(z.string()),
  })
  .strict();
export type DocumentOutput = z.infer<typeof documentOutputSchema>;

export const implementStage1OutputSchema = z
  .object({
    plan: z
      .array(
        z
          .object({
            file: z.string().min(1),
            action: z.enum(["CREATE", "MODIFY", "DELETE"]),
            description: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
    risks: z.array(z.string()),
    blockingQuestions: z.array(z.string()),
  })
  .strict();
export type ImplementStage1Output = z.infer<typeof implementStage1OutputSchema>;

export const implementStage2OutputSchema = z
  .object({
    files: z
      .array(
        z
          .object({
            path: z.string().min(1),
            content: z.string(),
            language: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
    summary: z.string().min(1),
  })
  .strict();
export type ImplementStage2Output = z.infer<typeof implementStage2OutputSchema>;

export type ModeOutput =
  ThinkOutput | ValidateOutput | DocumentOutput | ImplementStage1Output | ImplementStage2Output;
