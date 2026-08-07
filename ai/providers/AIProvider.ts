import type {
  AIChatRequest,
  AIChatResponse,
  AIEmbeddingsRequest,
  AIEmbeddingsResponse,
  AIProviderHealth,
} from "@/types/ai";

// Document 4 §7 — Provider Interface. Document 7 §9 — provider-specific
// code lives only inside ai/providers/; every provider implements this
// same contract so the Orchestrator (Document 4 §3) can swap providers
// without changing its own logic.
export interface AIProvider {
  chat(request: AIChatRequest): Promise<AIChatResponse>;
  stream(request: AIChatRequest): AsyncIterable<string>;
  embeddings(request: AIEmbeddingsRequest): Promise<AIEmbeddingsResponse>;
  health(): Promise<AIProviderHealth>;
}
