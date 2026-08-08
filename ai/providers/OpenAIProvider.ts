import OpenAI from "openai";
import type { AIProvider } from "@/ai/providers/AIProvider";
import type {
  AIChatRequest,
  AIChatResponse,
  AIEmbeddingsRequest,
  AIEmbeddingsResponse,
  AIProviderHealth,
} from "@/types/ai";
import { aiConfig } from "@/config/ai";
import { AIProviderError } from "@/lib/utils/errors";

// Document 4 §7 — MVP's only real provider (Anthropic/Google/Local are
// "future" per Document 4 §7). Document 1 §8 lists the OpenAI SDK as a
// required dependency.
//
// `response_format: { type: "json_object" }` is set unconditionally in
// `chat()`, not exposed as a field on the provider-agnostic `AIChatRequest`
// (Document 4 §7's interface is fixed to `messages`/`model`/`temperature`)
// — every mode's system prompt (Document 12 §3-6) already instructs
// "Respond only in the X output schema below," and every caller of this
// provider in this codebase is the AI Orchestrator, which always expects
// structured JSON back. Keeping the OpenAI-specific `response_format`
// choice inside this file, rather than growing the shared interface, is
// what "provider-specific code lives only inside ai/providers/"
// (Document 7 §9) means in practice. Response validation against the
// mode's Zod schema (Document 12 §7) remains the authoritative check
// either way — this is a reliability improvement, not a substitute for it.
export class OpenAIProvider implements AIProvider {
  private readonly client: OpenAI;

  constructor(client?: OpenAI) {
    this.client = client ?? new OpenAI({ apiKey: aiConfig.openaiApiKey });
  }

  async chat(request: AIChatRequest): Promise<AIChatResponse> {
    let completion: OpenAI.Chat.Completions.ChatCompletion;
    try {
      completion = await this.client.chat.completions.create({
        model: request.model ?? aiConfig.defaultModel,
        temperature: request.temperature ?? aiConfig.defaultTemperature,
        messages: request.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        response_format: { type: "json_object" },
      });
    } catch (error) {
      throw new AIProviderError(
        error instanceof Error ? error.message : "The AI provider request failed.",
      );
    }

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      // Document 4 §9 "Empty response detection" — an empty provider
      // response is itself a provider-level failure, checked here before
      // the Orchestrator's own schema validation ever runs.
      throw new AIProviderError("The AI provider returned an empty response.");
    }

    return {
      content,
      usage: completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
          }
        : undefined,
    };
  }

  async *stream(request: AIChatRequest): AsyncIterable<string> {
    let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
    try {
      stream = await this.client.chat.completions.create({
        model: request.model ?? aiConfig.defaultModel,
        temperature: request.temperature ?? aiConfig.defaultTemperature,
        messages: request.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        stream: true,
      });
    } catch (error) {
      throw new AIProviderError(
        error instanceof Error ? error.message : "The AI provider request failed.",
      );
    }

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  }

  // Document 9 Phase 5 authorization explicitly excludes Embeddings
  // ("Do NOT implement: ... Embeddings ... Vector search") — Document 9
  // Phase 9 reserves it. `AIProvider` (Document 4 §7) still declares this
  // method as part of the fixed provider contract, so the shape exists;
  // the body deliberately stays unimplemented rather than wiring the SDK,
  // and nothing in the Phase 5 Orchestrator/Context Retrieval pipeline
  // calls it.
  async embeddings(_request: AIEmbeddingsRequest): Promise<AIEmbeddingsResponse> {
    throw new Error(
      "OpenAIProvider.embeddings is intentionally unimplemented — Document 9 Phase 5 excludes Embeddings. See Document 9 Phase 9.",
    );
  }

  async health(): Promise<AIProviderHealth> {
    return { healthy: Boolean(aiConfig.openaiApiKey) };
  }
}
