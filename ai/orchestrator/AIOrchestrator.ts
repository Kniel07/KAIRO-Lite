import type { AIMode } from "@/types/ai";
import type { AIProvider } from "@/ai/providers/AIProvider";
import { OpenAIProvider } from "@/ai/providers/OpenAIProvider";
import { RepositoryContextRetriever, type ContextRetriever } from "@/ai/context/ContextRetriever";
import { selectPromptTemplate, type PromptTemplate } from "@/ai/prompts/templates";
import { buildPromptMessages } from "@/ai/prompts/PromptBuilder";
import type { ModeOutput } from "@/ai/schemas/ModeOutputSchemas";
import { AIProviderError } from "@/lib/utils/errors";
import { logger } from "@/lib/logger";

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
  content: ModeOutput;
  citations: string[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

/**
 * Document 4 §3 — "The AI Orchestrator is the single entry point for every
 * AI request. No UI component or API route may communicate directly with
 * an LLM." Flow (Document 4 §3): Context Retrieval → Prompt Builder → LLM
 * → Validation → Structured Response. Never writes to the database itself
 * (Document 4 §2) — persisting the resulting conversation turn is the
 * Route Handler's job, via `AIChatService` (Document 8 §2's AI-specific
 * flow diagram has no Service node between Route Handler and Orchestrator;
 * persistence is a separate, ordinary Route Handler → Service →
 * Repository call after this one).
 */
export class AIOrchestrator {
  constructor(
    private readonly provider: AIProvider,
    private readonly contextRetriever: ContextRetriever,
  ) {}

  async execute(request: AIOrchestratorRequest): Promise<AIOrchestratorResponse> {
    const template = selectPromptTemplate(request.mode, request.approved);

    const context = await this.contextRetriever.retrieve({
      userId: request.userId,
      prompt: request.prompt,
      projectId: request.projectId,
      conversationId: request.conversationId,
      knowledgeIds: request.knowledgeIds,
    });

    const messages = buildPromptMessages(template, context, request.prompt);
    const response = await this.provider.chat({ messages });
    const content = this.parseAndValidate(response.content, template, request);

    // Document 12 §2/§4 — knowledge actually placed in context is what the
    // response is grounded in; citing it is how "AI explains reasoning"
    // (Doc 4 §1) stays checkable against real rows, not the model's say-so.
    const citations = [...context.activeKnowledge, ...context.relatedKnowledge].map(
      (entry) => entry.id,
    );

    return { content, citations, usage: response.usage };
  }

  /**
   * Document 12 §7 — Response Validation, applied uniformly: (1) JSON
   * validity, (2) required fields, (3) schema/type compliance, (4) empty
   * response (handled by the provider itself — Document 4 §9), (5) role
   * compliance / cross-mode leakage (enforced by every output schema's
   * `.strict()` — see `ai/schemas/ModeOutputSchemas.ts`). Any failure
   * discards the response, logs it, and raises `AI_PROVIDER_ERROR`
   * (Document 8 §18) — "Invalid responses never reach the UI" (Doc 4 §9).
   */
  private parseAndValidate(
    raw: string,
    template: PromptTemplate,
    request: AIOrchestratorRequest,
  ): ModeOutput {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      this.logValidationFailure(request, template, "response was not valid JSON");
      throw new AIProviderError("The AI provider response was not valid JSON.");
    }

    const result = template.outputSchema.safeParse(json);
    if (!result.success) {
      const reason = result.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ");
      this.logValidationFailure(request, template, reason);
      throw new AIProviderError("The AI provider response failed schema validation.");
    }

    return result.data as ModeOutput;
  }

  private logValidationFailure(
    request: AIOrchestratorRequest,
    template: PromptTemplate,
    reason: string,
  ): void {
    logger.audit("AI response failed validation and was discarded", {
      actor: request.userId,
      action: request.mode,
      entity: "AIResponse",
      result: "failure",
      template: template.key,
      reason,
    });
  }
}

// Document 5 §5 — "Components never call OpenAI" / "Components never call
// an AI provider directly" is enforced by ESLint blocking `@/ai/providers`
// from `components/**` and `app/**` entirely (including Route Handlers).
// This factory is the one place that constructs the default provider +
// context retriever, so `app/api/v1/ai/chat/route.ts` only ever imports
// `AIOrchestrator` — never a concrete provider — while still being the
// place that "delegates to the AI Orchestrator" (Document 8 §14).
export function createAIOrchestrator(): AIOrchestrator {
  return new AIOrchestrator(new OpenAIProvider(), new RepositoryContextRetriever());
}
