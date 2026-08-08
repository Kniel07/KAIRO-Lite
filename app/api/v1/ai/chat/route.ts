import type { NextRequest } from "next/server";
import { createAIOrchestrator } from "@/ai/orchestrator/AIOrchestrator";
import { AIChatService } from "@/features/ai/services/AIChatService";
import { aiChatRequestSchema } from "@/features/ai/schemas/AIChatSchema";
import { requireUserId } from "@/lib/auth/session";
import { successResponse, errorResponse } from "@/lib/utils/http";
import { parseOrThrow } from "@/lib/validation";
import { parseRequestBody } from "@/lib/utils/parse-request-body";
import { logger } from "@/lib/logger";

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
    //
    // Document 13 §26 (Phase 5.5, Amendment 24) — persistence failure is
    // handled separately from every earlier failure in this handler: by
    // the time we reach this line, a real, validated AI response already
    // exists. Losing it because a database write hiccupped would force
    // the caller to regenerate (and re-pay for) an answer that already
    // succeeded, so a persistence failure degrades to a 200 with the
    // content still attached and `conversationId: null`, rather than
    // discarding the response the same way an upstream failure would.
    try {
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
    } catch (persistError) {
      logger.error("AI response generated successfully but could not be persisted", {
        actor: userId,
        action: input.mode,
        entity: "Conversation",
        result: "failure",
        reason: persistError instanceof Error ? persistError.message : String(persistError),
      });

      return successResponse(
        {
          response: result.content,
          citations: result.citations,
          usage: result.usage,
          conversationId: null,
          warning:
            "Your response was generated successfully but could not be saved to your conversation history.",
        },
        { status: 200 },
      );
    }
  } catch (error) {
    return errorResponse(error);
  }
}
