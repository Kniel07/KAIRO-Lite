// Document 8 §18 — stable error codes. Document 8 §8 — HTTP status mapping.
// Document 7 §10 — errors carry context (operation/entity), are never
// swallowed, and are re-thrown after logging by the caller.

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "PROJECT_NOT_FOUND"
  | "KNOWLEDGE_NOT_FOUND"
  | "DOCUMENT_NOT_FOUND"
  | "NOTE_NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "AI_PROVIDER_ERROR"
  | "RATE_LIMITED"
  | "UNKNOWN_ERROR";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;

  constructor(code: ErrorCode, message: string, httpStatus: number) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed.") {
    super("VALIDATION_ERROR", message, 400);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required.") {
    super("UNAUTHORIZED", message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this resource.") {
    super("FORBIDDEN", message, 403);
    this.name = "ForbiddenError";
  }
}

// Document 6 §7 — function/entity naming; Document 8 §18 lists
// PROJECT_NOT_FOUND / KNOWLEDGE_NOT_FOUND / DOCUMENT_NOT_FOUND explicitly.
// NOTE was added in Phase 3 for NotesService. Additional entities extend
// this union as later phases introduce them.
export type NotFoundEntity = "PROJECT" | "KNOWLEDGE" | "DOCUMENT" | "NOTE";

export class NotFoundError extends AppError {
  constructor(entity: NotFoundEntity, message?: string) {
    super(`${entity}_NOT_FOUND` as ErrorCode, message ?? `${entity} not found.`, 404);
    this.name = "NotFoundError";
  }
}

// Document 8 §8 sanctions HTTP 409 but Document 8 §18's error-code list has
// no dedicated CONFLICT code; reusing VALIDATION_ERROR is the smallest fit
// until a documentation amendment adds one explicitly.
export class ConflictError extends AppError {
  constructor(message = "Resource already exists.") {
    super("VALIDATION_ERROR", message, 409);
    this.name = "ConflictError";
  }
}

export class AIProviderError extends AppError {
  constructor(message = "The AI provider request failed.") {
    super("AI_PROVIDER_ERROR", message, 502);
    this.name = "AIProviderError";
  }
}

export class RateLimitedError extends AppError {
  constructor(message = "Too many requests.") {
    super("RATE_LIMITED", message, 429);
    this.name = "RateLimitedError";
  }
}

export class UnknownError extends AppError {
  constructor(message = "An unexpected error occurred.") {
    super("UNKNOWN_ERROR", message, 500);
    this.name = "UnknownError";
  }
}
