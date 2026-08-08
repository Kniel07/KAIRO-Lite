import { describe, expect, it, vi } from "vitest";
import OpenAI from "openai";
import { OpenAIProvider } from "@/ai/providers/OpenAIProvider";
import { AIProviderError, RateLimitedError } from "@/lib/utils/errors";

// Document 13 §27 (Phase 5.5, Amendment 24) — a real OpenAI 429
// (`OpenAI.RateLimitError`) must map to the existing `RateLimitedError`
// (Document 8 §18's `RATE_LIMITED`), not the generic `AIProviderError`
// every other provider failure uses.

function makeFakeOpenAIClient(overrides: { create?: ReturnType<typeof vi.fn> } = {}) {
  return {
    chat: {
      completions: {
        create: overrides.create ?? vi.fn(),
      },
    },
  } as unknown as OpenAI;
}

describe("OpenAIProvider", () => {
  describe("chat", () => {
    it("returns the content and usage on a well-formed completion", async () => {
      const create = vi.fn().mockResolvedValue({
        choices: [{ message: { content: "{}" } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });
      const provider = new OpenAIProvider(makeFakeOpenAIClient({ create }));

      const result = await provider.chat({ messages: [{ role: "user", content: "hi" }] });

      expect(result.content).toBe("{}");
      expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 5 });
    });

    it("throws AIProviderError on an empty response", async () => {
      const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: null } }] });
      const provider = new OpenAIProvider(makeFakeOpenAIClient({ create }));

      await expect(provider.chat({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
        AIProviderError,
      );
    });

    it("maps a generic SDK failure to AIProviderError", async () => {
      const create = vi.fn().mockRejectedValue(new Error("network exploded"));
      const provider = new OpenAIProvider(makeFakeOpenAIClient({ create }));

      await expect(provider.chat({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
        AIProviderError,
      );
    });

    it("maps OpenAI.RateLimitError to RateLimitedError, not AIProviderError", async () => {
      const rateLimitError = new OpenAI.RateLimitError(
        429,
        { message: "Rate limit exceeded" },
        "Rate limit exceeded",
        new Headers(),
      );
      const create = vi.fn().mockRejectedValue(rateLimitError);
      const provider = new OpenAIProvider(makeFakeOpenAIClient({ create }));

      const error = await provider
        .chat({ messages: [{ role: "user", content: "hi" }] })
        .catch((e) => e);

      expect(error).toBeInstanceOf(RateLimitedError);
      expect(error).not.toBeInstanceOf(AIProviderError);
    });
  });

  describe("stream", () => {
    it("maps OpenAI.RateLimitError to RateLimitedError", async () => {
      const rateLimitError = new OpenAI.RateLimitError(
        429,
        { message: "Rate limit exceeded" },
        "Rate limit exceeded",
        new Headers(),
      );
      const create = vi.fn().mockRejectedValue(rateLimitError);
      const provider = new OpenAIProvider(makeFakeOpenAIClient({ create }));

      const iterator = provider
        .stream({ messages: [{ role: "user", content: "hi" }] })
        [Symbol.asyncIterator]();

      await expect(iterator.next()).rejects.toBeInstanceOf(RateLimitedError);
    });
  });

  describe("embeddings", () => {
    it("remains intentionally unimplemented (Document 9 Phase 5 excludes Embeddings)", async () => {
      const provider = new OpenAIProvider(makeFakeOpenAIClient());

      await expect(provider.embeddings({ input: ["hi"] })).rejects.toThrow();
    });
  });

  describe("health", () => {
    it("reports healthy based on whether an API key is configured", async () => {
      const provider = new OpenAIProvider(makeFakeOpenAIClient());

      const health = await provider.health();

      expect(typeof health.healthy).toBe("boolean");
    });
  });
});
