import { describe, expect, it, vi } from "vitest";
import { AIOrchestrator } from "@/ai/orchestrator/AIOrchestrator";
import type { AIProvider } from "@/ai/providers/AIProvider";
import type { AssembledContext, ContextRetriever } from "@/ai/context/ContextRetriever";
import type { AIChatResponse } from "@/types/ai";
import type { Message } from "@/types/database";
import { AIProviderError, ValidationError } from "@/lib/utils/errors";

// Document 13 §27 (Phase 5.5, Amendment 24) — a valid prior Stage 1 plan,
// as it would actually appear in `conversationHistory` (an ASSISTANT
// message with `mode: "IMPLEMENT"` whose content is the Stage 1 JSON).
function makeApprovedStage1Message(): Message {
  return {
    id: "message-stage1",
    conversationId: "conversation-1",
    role: "ASSISTANT",
    content: JSON.stringify({
      plan: [{ file: "a.ts", action: "CREATE", description: "d" }],
      risks: [],
      blockingQuestions: [],
    }),
    mode: "IMPLEMENT",
    tokenCount: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  } as Message;
}

// Document 12 §7 — Response Validation is the core behavior under test
// here: every mode's output schema is `.strict()` (Document 12 §7 check 5,
// "role compliance"/cross-mode leakage), and any JSON/schema failure must
// raise `AI_PROVIDER_ERROR` (Document 8 §18) rather than let the raw
// response reach the caller (Document 4 §9).

function makeContext(overrides: Partial<AssembledContext> = {}): AssembledContext {
  return {
    activeKnowledge: [],
    relatedKnowledge: [],
    conversationHistory: [],
    globalKnowledge: [],
    ...overrides,
  };
}

function makeProvider(response: Partial<AIChatResponse>): AIProvider {
  return {
    chat: vi.fn().mockResolvedValue({ content: "{}", ...response }),
    stream: vi.fn(),
    embeddings: vi.fn(),
    health: vi.fn(),
  };
}

function makeContextRetriever(context: AssembledContext = makeContext()): ContextRetriever {
  return { retrieve: vi.fn().mockResolvedValue(context) };
}

describe("AIOrchestrator", () => {
  describe("THINK", () => {
    it("returns the validated structured output on a well-formed response", async () => {
      const validOutput = {
        ideas: [{ title: "A", description: "d", assumptions: ["x"], tradeoffs: ["y"] }],
        openQuestions: ["what about z?"],
      };
      const provider = makeProvider({ content: JSON.stringify(validOutput) });
      const orchestrator = new AIOrchestrator(provider, makeContextRetriever());

      const result = await orchestrator.execute({
        mode: "THINK",
        prompt: "brainstorm",
        userId: "user-1",
      });

      expect(result.content).toEqual(validOutput);
    });

    it("rejects a response that leaks another mode's shape (cross-mode leakage)", async () => {
      // A `files` array is IMPLEMENT Stage 2's field, never THINK's.
      const leaked = {
        ideas: [{ title: "A", description: "d", assumptions: [], tradeoffs: [] }],
        openQuestions: [],
        files: [{ path: "a.ts", content: "", language: "ts" }],
      };
      const provider = makeProvider({ content: JSON.stringify(leaked) });
      const orchestrator = new AIOrchestrator(provider, makeContextRetriever());

      await expect(
        orchestrator.execute({ mode: "THINK", prompt: "brainstorm", userId: "user-1" }),
      ).rejects.toThrow(AIProviderError);
    });

    it("rejects non-JSON responses", async () => {
      const provider = makeProvider({ content: "not json at all" });
      const orchestrator = new AIOrchestrator(provider, makeContextRetriever());

      await expect(
        orchestrator.execute({ mode: "THINK", prompt: "brainstorm", userId: "user-1" }),
      ).rejects.toThrow(AIProviderError);
    });

    it("rejects a response missing required fields", async () => {
      const provider = makeProvider({ content: JSON.stringify({ openQuestions: [] }) });
      const orchestrator = new AIOrchestrator(provider, makeContextRetriever());

      await expect(
        orchestrator.execute({ mode: "THINK", prompt: "brainstorm", userId: "user-1" }),
      ).rejects.toThrow(AIProviderError);
    });
  });

  describe("VALIDATE", () => {
    it("accepts a well-formed review report", async () => {
      const validOutput = {
        issues: [{ severity: "HIGH", description: "d", location: "l", recommendation: "r" }],
        risks: ["risk"],
        missingRequirements: [],
        verdict: "NEEDS_REVISION",
      };
      const provider = makeProvider({ content: JSON.stringify(validOutput) });
      const orchestrator = new AIOrchestrator(provider, makeContextRetriever());

      const result = await orchestrator.execute({
        mode: "VALIDATE",
        prompt: "review",
        userId: "user-1",
      });

      expect(result.content).toEqual(validOutput);
    });

    it("rejects an invalid verdict enum value", async () => {
      const provider = makeProvider({
        content: JSON.stringify({
          issues: [],
          risks: [],
          missingRequirements: [],
          verdict: "MAYBE",
        }),
      });
      const orchestrator = new AIOrchestrator(provider, makeContextRetriever());

      await expect(
        orchestrator.execute({ mode: "VALIDATE", prompt: "review", userId: "user-1" }),
      ).rejects.toThrow(AIProviderError);
    });
  });

  describe("DOCUMENT", () => {
    it("accepts a well-formed structured document", async () => {
      const validOutput = {
        title: "Spec",
        sections: [{ heading: "Overview", content: "..." }],
        format: "markdown",
        incompleteSections: [],
      };
      const provider = makeProvider({ content: JSON.stringify(validOutput) });
      const orchestrator = new AIOrchestrator(provider, makeContextRetriever());

      const result = await orchestrator.execute({
        mode: "DOCUMENT",
        prompt: "write this up",
        userId: "user-1",
      });

      expect(result.content).toEqual(validOutput);
    });

    it("treats an incomplete-but-honest section list as a pass, not a failure", async () => {
      const validOutput = {
        title: "Spec",
        sections: [{ heading: "Overview", content: "..." }],
        format: "markdown",
        incompleteSections: ["Rollout Plan"],
      };
      const provider = makeProvider({ content: JSON.stringify(validOutput) });
      const orchestrator = new AIOrchestrator(provider, makeContextRetriever());

      await expect(
        orchestrator.execute({ mode: "DOCUMENT", prompt: "write this up", userId: "user-1" }),
      ).resolves.toBeDefined();
    });
  });

  describe("IMPLEMENT", () => {
    it("selects the Stage 1 (Plan) schema when approved is not passed", async () => {
      const stage1Output = {
        plan: [{ file: "a.ts", action: "CREATE", description: "d" }],
        risks: [],
        blockingQuestions: [],
      };
      const provider = makeProvider({ content: JSON.stringify(stage1Output) });
      const orchestrator = new AIOrchestrator(provider, makeContextRetriever());

      const result = await orchestrator.execute({
        mode: "IMPLEMENT",
        prompt: "implement X",
        userId: "user-1",
      });

      expect(result.content).toEqual(stage1Output);
    });

    it("rejects Stage 1 output that contains code (a `files` field)", async () => {
      const leaked = {
        plan: [{ file: "a.ts", action: "CREATE", description: "d" }],
        risks: [],
        blockingQuestions: [],
        files: [{ path: "a.ts", content: "code", language: "ts" }],
      };
      const provider = makeProvider({ content: JSON.stringify(leaked) });
      const orchestrator = new AIOrchestrator(provider, makeContextRetriever());

      await expect(
        orchestrator.execute({ mode: "IMPLEMENT", prompt: "implement X", userId: "user-1" }),
      ).rejects.toThrow(AIProviderError);
    });

    it("selects the Stage 2 (Code) schema when approved: true is passed AND a prior Stage 1 plan is in conversation history", async () => {
      const stage2Output = {
        files: [{ path: "a.ts", content: "code", language: "ts" }],
        summary: "done",
      };
      const provider = makeProvider({ content: JSON.stringify(stage2Output) });
      const contextWithStage1 = makeContext({ conversationHistory: [makeApprovedStage1Message()] });
      const orchestrator = new AIOrchestrator(provider, makeContextRetriever(contextWithStage1));

      const result = await orchestrator.execute({
        mode: "IMPLEMENT",
        prompt: "implement X",
        userId: "user-1",
        conversationId: "conversation-1",
        approved: true,
      });

      expect(result.content).toEqual(stage2Output);
    });

    it("rejects approved: true when no prior Stage 1 plan exists in conversation history", async () => {
      const stage2Output = {
        files: [{ path: "a.ts", content: "code", language: "ts" }],
        summary: "done",
      };
      const provider = makeProvider({ content: JSON.stringify(stage2Output) });
      // No conversationId / no prior history at all.
      const orchestrator = new AIOrchestrator(provider, makeContextRetriever());

      await expect(
        orchestrator.execute({
          mode: "IMPLEMENT",
          prompt: "implement X",
          userId: "user-1",
          approved: true,
        }),
      ).rejects.toThrow(ValidationError);
      expect(provider.chat).not.toHaveBeenCalled();
    });

    it("rejects approved: true when the conversation history contains messages but no valid Stage 1 plan", async () => {
      const provider = makeProvider({ content: JSON.stringify({ files: [], summary: "x" }) });
      const unrelatedMessage: Message = {
        id: "message-unrelated",
        conversationId: "conversation-1",
        role: "ASSISTANT",
        content: JSON.stringify({ ideas: [], openQuestions: [] }), // a THINK response, not a plan
        mode: "THINK",
        tokenCount: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      } as Message;
      const contextWithoutPlan = makeContext({ conversationHistory: [unrelatedMessage] });
      const orchestrator = new AIOrchestrator(provider, makeContextRetriever(contextWithoutPlan));

      await expect(
        orchestrator.execute({
          mode: "IMPLEMENT",
          prompt: "implement X",
          userId: "user-1",
          conversationId: "conversation-1",
          approved: true,
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("does not accept Stage 2 output when approved is false/omitted (still validates against Stage 1's schema)", async () => {
      const stage2Output = {
        files: [{ path: "a.ts", content: "code", language: "ts" }],
        summary: "done",
      };
      const provider = makeProvider({ content: JSON.stringify(stage2Output) });
      const orchestrator = new AIOrchestrator(provider, makeContextRetriever());

      await expect(
        orchestrator.execute({ mode: "IMPLEMENT", prompt: "implement X", userId: "user-1" }),
      ).rejects.toThrow(AIProviderError);
    });
  });

  describe("citations", () => {
    it("cites the ids of active and related Knowledge actually placed in context", async () => {
      const knowledgeFields = {
        title: "K",
        category: "general",
        summary: "s",
        markdown: "m",
      };
      const context = makeContext({
        activeKnowledge: [
          { id: "k-active", ...knowledgeFields },
        ] as AssembledContext["activeKnowledge"],
        relatedKnowledge: [
          { id: "k-related", ...knowledgeFields },
        ] as AssembledContext["relatedKnowledge"],
      });
      const validOutput = {
        ideas: [{ title: "A", description: "d", assumptions: [], tradeoffs: [] }],
        openQuestions: [],
      };
      const provider = makeProvider({ content: JSON.stringify(validOutput) });
      const orchestrator = new AIOrchestrator(provider, makeContextRetriever(context));

      const result = await orchestrator.execute({ mode: "THINK", prompt: "hi", userId: "user-1" });

      expect(result.citations).toEqual(["k-active", "k-related"]);
    });
  });

  it("passes the retrieved context's userId/prompt/projectId/conversationId/knowledgeIds through to the context retriever", async () => {
    const contextRetriever = makeContextRetriever();
    const provider = makeProvider({
      content: JSON.stringify({
        ideas: [{ title: "A", description: "d", assumptions: [], tradeoffs: [] }],
        openQuestions: [],
      }),
    });
    const orchestrator = new AIOrchestrator(provider, contextRetriever);

    await orchestrator.execute({
      mode: "THINK",
      prompt: "hi",
      userId: "user-1",
      projectId: "project-1",
      conversationId: "conversation-1",
      knowledgeIds: ["k-1"],
    });

    expect(contextRetriever.retrieve).toHaveBeenCalledWith({
      userId: "user-1",
      prompt: "hi",
      projectId: "project-1",
      conversationId: "conversation-1",
      knowledgeIds: ["k-1"],
    });
  });

  describe("user Settings applied to the provider call", () => {
    it("passes the caller's defaultModel/aiTemperature from Settings to provider.chat", async () => {
      const context = makeContext({
        userPreferences: {
          id: "settings-1",
          userId: "user-1",
          theme: "SYSTEM",
          defaultModel: "gpt-4.1-mini",
          aiTemperature: 0.2,
          language: "en",
          timezone: "UTC",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as AssembledContext["userPreferences"],
      });
      const provider = makeProvider({
        content: JSON.stringify({
          ideas: [{ title: "A", description: "d", assumptions: [], tradeoffs: [] }],
          openQuestions: [],
        }),
      });
      const orchestrator = new AIOrchestrator(provider, makeContextRetriever(context));

      await orchestrator.execute({ mode: "THINK", prompt: "hi", userId: "user-1" });

      expect(provider.chat).toHaveBeenCalledWith(
        expect.objectContaining({ model: "gpt-4.1-mini", temperature: 0.2 }),
      );
    });

    it("passes undefined model/temperature when no Settings row exists, letting the provider fall back to its own defaults", async () => {
      const provider = makeProvider({
        content: JSON.stringify({
          ideas: [{ title: "A", description: "d", assumptions: [], tradeoffs: [] }],
          openQuestions: [],
        }),
      });
      const orchestrator = new AIOrchestrator(provider, makeContextRetriever(makeContext()));

      await orchestrator.execute({ mode: "THINK", prompt: "hi", userId: "user-1" });

      expect(provider.chat).toHaveBeenCalledWith(
        expect.objectContaining({ model: undefined, temperature: undefined }),
      );
    });
  });
});
