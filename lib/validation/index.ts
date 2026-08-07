import type { z } from "zod";
import { ValidationError } from "@/lib/utils/errors";

// Document 7 §11 — "All external input must be validated ... using Zod ...
// Never trust external input." This is the single boundary helper every
// Service/Route Handler uses to turn a ZodSchema failure into the project's
// standard ValidationError (Document 8 §18's VALIDATION_ERROR).

export function parseOrThrow<Schema extends z.ZodTypeAny>(
  schema: Schema,
  input: unknown,
): z.infer<Schema> {
  const result = schema.safeParse(input);

  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new ValidationError(message);
  }

  return result.data;
}
