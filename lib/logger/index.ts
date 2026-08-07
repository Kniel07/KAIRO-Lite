// Document 7 §12 — structured logging. Every important operation logs
// actor, action, timestamp, entity, result. Never logs secrets — callers
// are responsible for not passing secret values into `context`.

export type LogContext = Record<string, unknown>;

export interface AuditLogContext extends LogContext {
  actor: string;
  action: string;
  entity: string;
  result: "success" | "failure";
}

type Level = "info" | "warn" | "error";

function write(level: Level, message: string, context?: LogContext): void {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info(message: string, context?: LogContext): void {
    write("info", message, context);
  },
  warn(message: string, context?: LogContext): void {
    write("warn", message, context);
  },
  error(message: string, context?: LogContext): void {
    write("error", message, context);
  },
  /**
   * Structured operational logging in the actor/action/entity/result shape
   * (Document 7 §12). This is a log line, not a substitute for the
   * persisted `AuditLog` entity (Document 10 §5.10) — the immutable audit
   * trail is written by `GovernanceService`/repositories once Phase 2/3
   * exist.
   */
  audit(message: string, context: AuditLogContext): void {
    write("info", message, context);
  },
};
