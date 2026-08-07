import type { AIMode } from "@/types/ai";
import type { AIProvider } from "@/ai/providers/AIProvider";
import type { ContextRetriever } from "@/ai/context/ContextRetriever";

// Document 8 §23 — AI Contract (mode + prompt required; projectId,
// conversationId, knowledgeIds optional). `approved` is Document 12 §6's
// IMPLEMENT-mode Stage 2 gate.
export interface AIOrchestratorRequest {
  mode: AIMode;
  prompt: string;
  userId: string;
  projectId?: string;
  conversationId?: string;
  knowledgeIds?: string[];
  approved?: boolean;
}

export interface AIOrchestratorResponse {
  // TODO(Document 12): typed per-mode output (ThinkOutput / ValidateOutput /
  // DocumentOutput / Stage1|Stage2 Implement output) once Phase 5 implements
  // the prompt library's response schemas.
  content: unknown;
  citations: string[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

/**
 * Document 4 §3 — "The AI Orchestrator is the single entry point for every
 * AI request. No UI component or API route may communicate directly with
 * an LLM." This class establishes that single-entry-point shape; Phase 5
 * implements the body per Document 4 and Document 12.
 */
export class AIOrchestrator {
  constructor(
    private readonly provider: AIProvider,
    private readonly contextRetriever: ContextRetriever,
  ) {}

  async execute(_request: AIOrchestratorRequest): Promise<AIOrchestratorResponse> {
    // TODO(Document 4 §3, Document 12; Phase 5 — AI Layer):
    // 1. this.contextRetriever.retrieve(...) — Document 4 §6 priority order.
    // 2. Select + assemble the Document 12 prompt template for `_request.mode`.
    // 3. this.provider.chat(...) / .stream(...).
    // 4. Validate the response against the mode's output schema (Document 4 §9);
    //    invalid responses never reach the caller.
    void this.provider;
    void this.contextRetriever;
    throw new Error("AIOrchestrator.execute is not implemented yet. See Document 4 §3, Phase 5.");
  }
}
