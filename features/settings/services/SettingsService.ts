import type { Settings } from "@/types/database";
import { withTransaction } from "@/lib/db/transaction";
import {
  SettingsRepository,
  type SettingsRepositoryLike,
} from "@/features/settings/repositories/SettingsRepository";
import {
  AuditLogRepository,
  type AuditLogRepositoryLike,
} from "@/lib/db/repositories/AuditLogRepository";
import { updateSettingsSchema } from "@/features/settings/schemas/SettingsSchema";
import { parseOrThrow } from "@/lib/validation";
import { aiConfig } from "@/config/ai";
import type { ServiceContext } from "@/features/shared/types/Service";

// Document 7 §7-8, Document 8 §15, Document 13 §20-style transaction
// boundaries — SettingsService. Not part of Phase 3's module list
// (Document 9 scoped Phase 3 to Project/Knowledge/Notes/Document/Search/
// Governance) — added in Phase 4 because Document 8 §15 requires a
// Settings API and the Component → Route → Service → Repository → Prisma
// chain (Document 7 §8) means the Settings Route Handler needs a Service
// to call, not direct Repository access. A small, mechanical gap-fill, not
// a redesign: Settings' shape was already fully specified in Document 10
// §5.11.
//
// `Settings` is a 1:1 per-user config row with no owner-mismatch case to
// authorize against — `context.userId` *is* the row's key, unlike every
// other Service's ownership check. Document 8 §21 requires Settings
// changes to be audited; the one-time auto-provisioning in `ensureExists`
// (first access for a user with no row yet — the seed script normally
// creates this ahead of time, Document 9 Phase 2) is audited as a CREATE
// the same as an explicit change would be.
export class SettingsService {
  constructor(
    private readonly settingsRepository: SettingsRepositoryLike = new SettingsRepository(),
    private readonly auditLogRepository: AuditLogRepositoryLike = new AuditLogRepository(),
  ) {}

  async get(context: ServiceContext): Promise<Settings> {
    return this.ensureExists(context.userId);
  }

  async update(context: ServiceContext, rawInput: unknown): Promise<Settings> {
    const input = parseOrThrow(updateSettingsSchema, rawInput);
    const existing = await this.ensureExists(context.userId);

    return withTransaction(async (tx) => {
      const settingsRepository = new SettingsRepository(tx);
      const auditLogRepository = new AuditLogRepository(tx);

      const settings = await settingsRepository.update(context.userId, input);

      await auditLogRepository.record({
        entity: "Settings",
        entityId: settings.id,
        operation: "UPDATE",
        actorId: context.userId,
        before: toSettingsAuditSnapshot(existing),
        after: toSettingsAuditSnapshot(settings),
      });

      return settings;
    });
  }

  private async ensureExists(userId: string): Promise<Settings> {
    const existing = await this.settingsRepository.findByUserId(userId);
    if (existing) {
      return existing;
    }

    return withTransaction(async (tx) => {
      const settingsRepository = new SettingsRepository(tx);
      const auditLogRepository = new AuditLogRepository(tx);

      const settings = await settingsRepository.create({
        user: { connect: { id: userId } },
        defaultModel: aiConfig.defaultModel,
        aiTemperature: aiConfig.defaultTemperature,
      });

      await auditLogRepository.record({
        entity: "Settings",
        entityId: settings.id,
        operation: "CREATE",
        actorId: userId,
        after: toSettingsAuditSnapshot(settings),
      });

      return settings;
    });
  }
}

// JSON-safe audit snapshot — see `ProjectService`'s equivalent for why
// this avoids importing Prisma's `InputJsonValue` type directly.
function toSettingsAuditSnapshot(settings: Settings) {
  return {
    theme: settings.theme,
    defaultModel: settings.defaultModel,
    aiTemperature: settings.aiTemperature,
    language: settings.language,
    timezone: settings.timezone,
  };
}
