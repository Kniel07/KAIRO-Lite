import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Settings } from "@/types/database";
import type { SettingsRepositoryLike } from "@/features/settings/repositories/SettingsRepository";
import type { AuditLogRepositoryLike } from "@/lib/db/repositories/AuditLogRepository";
import { ValidationError } from "@/lib/utils/errors";
import { SettingsService } from "@/features/settings/services/SettingsService";

// Document 13 §20 (Phase 3/4) — same test-strategy split documented in the
// other Service test files.

const mockDb = {
  settings: {
    create: vi.fn(),
    update: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/db/transaction", () => ({
  withTransaction: (fn: (tx: unknown) => unknown) => fn(mockDb),
}));

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    id: "settings-1",
    userId: "user-1",
    theme: "SYSTEM",
    defaultModel: "gpt-4.1",
    aiTemperature: 0.7,
    language: "en",
    timezone: "UTC",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as Settings;
}

function makeFakeRepositories() {
  const settingsRepository: SettingsRepositoryLike = {
    findByUserId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const auditLogRepository: AuditLogRepositoryLike = {
    record: vi.fn(),
    findByEntity: vi.fn(),
  };
  return { settingsRepository, auditLogRepository };
}

const context = { userId: "user-1" };

function makeService(repos: ReturnType<typeof makeFakeRepositories>) {
  return new SettingsService(repos.settingsRepository, repos.auditLogRepository);
}

describe("SettingsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.settings.create.mockReset();
    mockDb.settings.update.mockReset();
    mockDb.auditLog.create.mockReset();
  });

  describe("get", () => {
    it("returns the existing row without creating one", async () => {
      const repos = makeFakeRepositories();
      const existing = makeSettings();
      vi.mocked(repos.settingsRepository.findByUserId).mockResolvedValue(existing);
      const service = makeService(repos);

      await expect(service.get(context)).resolves.toEqual(existing);
      expect(mockDb.settings.create).not.toHaveBeenCalled();
    });

    it("auto-provisions defaults and records a CREATE audit entry when no row exists", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.settingsRepository.findByUserId).mockResolvedValue(null);
      const created = makeSettings();
      mockDb.settings.create.mockResolvedValue(created);
      mockDb.auditLog.create.mockResolvedValue({});
      const service = makeService(repos);

      const result = await service.get(context);

      expect(result).toEqual(created);
      expect(mockDb.settings.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ user: { connect: { id: "user-1" } } }),
      });
      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ entity: "Settings", operation: "CREATE" }),
      });
    });
  });

  describe("update", () => {
    it("throws ValidationError before opening a transaction on invalid input", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.settingsRepository.findByUserId).mockResolvedValue(makeSettings());
      const service = makeService(repos);

      await expect(service.update(context, { aiTemperature: 5 })).rejects.toThrow(ValidationError);
      expect(mockDb.settings.update).not.toHaveBeenCalled();
    });

    it("updates the row and records an UPDATE audit entry with before/after", async () => {
      const repos = makeFakeRepositories();
      const existing = makeSettings({ theme: "SYSTEM" });
      vi.mocked(repos.settingsRepository.findByUserId).mockResolvedValue(existing);
      const updated = makeSettings({ theme: "DARK" });
      mockDb.settings.update.mockResolvedValue(updated);
      mockDb.auditLog.create.mockResolvedValue({});
      const service = makeService(repos);

      const result = await service.update(context, { theme: "DARK" });

      expect(result).toEqual(updated);
      expect(mockDb.settings.update).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        data: { theme: "DARK" },
      });
      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entity: "Settings",
          operation: "UPDATE",
          before: expect.objectContaining({ theme: "SYSTEM" }),
          after: expect.objectContaining({ theme: "DARK" }),
        }),
      });
    });

    it("auto-provisions first, then updates, when no row exists yet", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.settingsRepository.findByUserId).mockResolvedValue(null);
      const provisioned = makeSettings();
      mockDb.settings.create.mockResolvedValue(provisioned);
      const updated = makeSettings({ language: "fr" });
      mockDb.settings.update.mockResolvedValue(updated);
      mockDb.auditLog.create.mockResolvedValue({});
      const service = makeService(repos);

      const result = await service.update(context, { language: "fr" });

      expect(result).toEqual(updated);
      expect(mockDb.settings.create).toHaveBeenCalled();
      expect(mockDb.settings.update).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        data: { language: "fr" },
      });
    });
  });
});
