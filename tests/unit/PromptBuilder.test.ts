import { describe, expect, it } from "vitest";
import { buildPromptMessages } from "@/ai/prompts/PromptBuilder";
import { PROMPT_TEMPLATES } from "@/ai/prompts/templates";
import type { AssembledContext } from "@/ai/context/ContextRetriever";
import type { Knowledge } from "@/types/database";

// Document 4 §5/§6 — Prompt Pipeline assembly and "avoid prompt bloat"
// (omit empty sections rather than emit "None").

function makeKnowledge(overrides: Partial<Knowledge> = {}): Knowledge {
  return {
    id: "k-1",
    title: "Some Knowledge",
    summary: "a short summary",
    markdown: "full markdown body",
    projectId: null,
    category: "engineering",
    confidence: 0.5,
    status: "DRAFT",
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
    ...overrides,
  } as Knowledge;
}

const emptyContext: AssembledContext = {
  activeKnowledge: [],
  relatedKnowledge: [],
  conversationHistory: [],
  globalKnowledge: [],
};

describe("buildPromptMessages", () => {
  it("returns exactly a system message and a user message", () => {
    const messages = buildPromptMessages(PROMPT_TEMPLATES.THINK, emptyContext, "brainstorm this");

    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe("system");
    expect(messages[1]).toEqual({ role: "user", content: "brainstorm this" });
  });

  it("includes the mode's system prompt and output schema in the system message", () => {
    const messages = buildPromptMessages(PROMPT_TEMPLATES.VALIDATE, emptyContext, "review this");

    expect(messages[0]?.content).toContain("You are the VALIDATE mode");
    expect(messages[0]?.content).toContain("Output JSON Schema");
  });

  it("omits context sections entirely when the assembled context is empty", () => {
    const messages = buildPromptMessages(PROMPT_TEMPLATES.THINK, emptyContext, "hi");

    expect(messages[0]?.content).not.toContain("Active Project");
    expect(messages[0]?.content).not.toContain("Active Document");
    expect(messages[0]?.content).not.toContain("Related Knowledge");
    expect(messages[0]?.content).not.toContain("Previous Conversation");
    expect(messages[0]?.content).not.toContain("Global Knowledge");
    expect(messages[0]?.content).not.toContain("User Preferences");
  });

  it("includes only the sections that have data", () => {
    const context: AssembledContext = {
      ...emptyContext,
      relatedKnowledge: [makeKnowledge()],
    };

    const messages = buildPromptMessages(PROMPT_TEMPLATES.THINK, context, "hi");

    expect(messages[0]?.content).toContain("Related Knowledge:");
    expect(messages[0]?.content).toContain("Some Knowledge");
    expect(messages[0]?.content).not.toContain("Active Project");
  });

  it("selects the IMPLEMENT Stage 1 template by default and Stage 2 only via the caller's PROMPT_TEMPLATES lookup", () => {
    const stage1Messages = buildPromptMessages(
      PROMPT_TEMPLATES.IMPLEMENT_STAGE_1,
      emptyContext,
      "implement X",
    );
    const stage2Messages = buildPromptMessages(
      PROMPT_TEMPLATES.IMPLEMENT_STAGE_2,
      emptyContext,
      "implement X",
    );

    expect(stage1Messages[0]?.content).toContain("Stage 1");
    expect(stage1Messages[0]?.content).not.toContain("Stage 2");
    expect(stage2Messages[0]?.content).toContain("Stage 2");
  });
});
