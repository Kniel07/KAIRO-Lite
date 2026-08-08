import { z } from "zod";
import type { AIProviderMessage } from "@/types/ai";
import type { PromptTemplate } from "@/ai/prompts/templates";
import type { AssembledContext } from "@/ai/context/ContextRetriever";

// Document 4 §5 — Prompt Pipeline: User Prompt + Project + Knowledge +
// Conversation + ... → Prompt Builder → LLM. Document 4 §6 — "Only
// relevant context should be injected. Avoid prompt bloat" — every
// section below is omitted entirely when empty, rather than emitted as
// "None."

const KNOWLEDGE_EXCERPT_LENGTH = 400;

export function buildPromptMessages(
  template: PromptTemplate,
  context: AssembledContext,
  userPrompt: string,
): AIProviderMessage[] {
  const sections = [
    serializeProject(context),
    serializeKnowledgeList("Active Document(s)", context.activeKnowledge),
    serializeKnowledgeList("Related Knowledge", context.relatedKnowledge),
    serializeConversation(context),
    serializeKnowledgeList("Global Knowledge", context.globalKnowledge),
    serializeUserPreferences(context),
  ].filter((section): section is string => section !== null);

  const outputSchemaBlock = serializeOutputSchema(template);

  const systemContent = [template.systemPrompt, outputSchemaBlock, ...sections]
    .filter(Boolean)
    .join("\n\n---\n\n");

  return [
    { role: "system", content: systemContent },
    { role: "user", content: userPrompt },
  ];
}

function serializeOutputSchema(template: PromptTemplate): string {
  const jsonSchema = z.toJSONSchema(template.outputSchema);
  return `Output JSON Schema (respond with a single JSON object matching this exactly):\n${JSON.stringify(jsonSchema)}`;
}

function serializeProject(context: AssembledContext): string | null {
  if (!context.project) return null;
  const { name, status, priority, description } = context.project;
  return `Active Project: ${name} (status: ${status}, priority: ${priority})${description ? `\n${description}` : ""}`;
}

function serializeKnowledgeList(
  label: string,
  entries: AssembledContext["relatedKnowledge"],
): string | null {
  if (!entries.length) return null;
  const lines = entries.map(
    (entry) =>
      `- ${entry.title} (category: ${entry.category}): ${entry.summary ?? entry.markdown.slice(0, KNOWLEDGE_EXCERPT_LENGTH)}`,
  );
  return `${label}:\n${lines.join("\n")}`;
}

function serializeConversation(context: AssembledContext): string | null {
  if (!context.conversationHistory.length) return null;
  const lines = context.conversationHistory.map((message) => `${message.role}: ${message.content}`);
  return `Previous Conversation:\n${lines.join("\n")}`;
}

function serializeUserPreferences(context: AssembledContext): string | null {
  if (!context.userPreferences) return null;
  const { language, defaultModel, aiTemperature } = context.userPreferences;
  return `User Preferences: language=${language}, defaultModel=${defaultModel}, aiTemperature=${aiTemperature}`;
}
