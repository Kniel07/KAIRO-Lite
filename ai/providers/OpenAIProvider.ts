import type { AIProvider } from "@/ai/providers/AIProvider";
import type {
  AIChatRequest,
  AIChatResponse,
  AIEmbeddingsRequest,
  AIEmbeddingsResponse,
  AIProviderHealth,
} from "@/types/ai";
import { aiConfig } from "@/config/ai";

// Document 4 §7 — MVP's only real provider (Anthropic/Google/Local are
// "future" per Document 4 §7). Document 1 §8 lists the OpenAI SDK as a
// required dependency; it is installed but not yet wired to the OpenAI
// client — that happens with the rest of the AI Layer in Phase 5.
//
// TODO(Document 4 §7, Document 12; Phase 5 — AI Layer): implement each
// method against the `openai` SDK. Method bodies are intentionally
// unimplemented here — "No AI prompts yet" (START IMPLEMENTATION scope,
// Phase 0/1 only).
export class OpenAIProvider implements AIProvider {
  async chat(_request: AIChatRequest): Promise<AIChatResponse> {
    throw new Error("OpenAIProvider.chat is not implemented yet. See Document 4 §7, Phase 5.");
  }

  async *stream(_request: AIChatRequest): AsyncIterable<string> {
    throw new Error("OpenAIProvider.stream is not implemented yet. See Document 4 §7, Phase 5.");
  }

  async embeddings(_request: AIEmbeddingsRequest): Promise<AIEmbeddingsResponse> {
    throw new Error(
      "OpenAIProvider.embeddings is not implemented yet. See Document 4 §7, Phase 5.",
    );
  }

  async health(): Promise<AIProviderHealth> {
    return { healthy: Boolean(aiConfig.openaiApiKey) };
  }
}
