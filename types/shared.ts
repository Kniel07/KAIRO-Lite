// Document 5 §9 — common cross-domain types.

export interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}
