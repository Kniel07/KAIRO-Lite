import type { NextRequest } from "next/server";
import { createAIOrchestrator } from "@/ai/orchestrator/AIOrchestrator";
import { AIChatService } from "@/features/ai/services/AIChatService";
import { aiChatRequestSchema } from "@/features/ai/schemas/AIChatSchema";
import { requireUserId } from "@/lib/auth/session";
import { successResponse, errorResponse } from "@/lib/utils/http";
import { parseOrThrow } from "@/lib/validation";
import { parseRequestBody } from "@/lib/utils/parse-request-body";

// Document 8 §14 — "The route handler delegates to the AI Orchestrator."
// This is the only Route Handler permitted to touch `ai/` at all (Document
// 4 §3 — "No UI component or API route may communicate directly with an
// LLM"); it never imports a concrete provider itself, only the Orchestrator
// factory (see that file's header comment).
const orchestrator = createAIOrchestrator();
const aiChatService = new AIChatService();

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await parseRequestBody(request);
    const input = parseOrThrow(aiChatRequestSchema, body);

    const result = await orchestrator.execute({
      mode: input.mode,
      prompt: input.prompt,
      userId,
      projectId: input.projectId,
      conversationId: input.conversationId,
      knowledgeIds: input.knowledgeIds,
      approved: input.approved,
    });

    // Document 4 §2 — the Orchestrator never writes to the database;
    // persisting the resulting turn is an ordinary Service call (Document
    // 7 §8's Component → Route Handler → Service → Repository → Prisma
    // chain), invoked here only after the Orchestrator's response has
    // already passed validation.
    const turn = await aiChatService.recordTurn(
      { userId },
      {
        mode: input.mode,
        prompt: input.prompt,
        projectId: input.projectId,
        conversationId: input.conversationId,
        response: result,
      },
    );

    return successResponse(
      {
        response: result.content,
        citations: result.citations,
        usage: result.usage,
        conversationId: turn.conversationId,
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
