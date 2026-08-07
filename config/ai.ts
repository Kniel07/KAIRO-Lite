import { env } from "@/config/env";

// Document 4 §7 — provider selection is owned by the AI Orchestrator, not
// scattered through the app. This module only holds static, non-secret
// defaults; the Orchestrator (ai/orchestrator) reads it, never components.
//
// TODO(Document 12): default temperature/model may later be overridden per
// request by the user's Settings (Document 10 §5.11) once Phase 3 exists.

export const aiConfig = {
  openaiApiKey: env.OPENAI_API_KEY,
  defaultModel: "gpt-4.1",
  defaultTemperature: 0.7,
} as const;
