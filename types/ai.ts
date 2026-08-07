// Document 4 §4 — the four AI Modes. Sourced verbatim (Document 13 §7,
// Amendment 6).
export type AIMode = "THINK" | "VALIDATE" | "DOCUMENT" | "IMPLEMENT";

export interface AIProviderMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIChatRequest {
  messages: AIProviderMessage[];
  model?: string;
  temperature?: number;
}

export interface AIChatResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface AIEmbeddingsRequest {
  input: string[];
  model?: string;
}

export interface AIEmbeddingsResponse {
  embeddings: number[][];
}

export interface AIProviderHealth {
  healthy: boolean;
  message?: string;
}
