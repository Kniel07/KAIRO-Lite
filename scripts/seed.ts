import "dotenv/config";
import { prisma } from "@/lib/db/client";
import { appConfig } from "@/config/app";
import { aiConfig } from "@/config/ai";
import { logger } from "@/lib/logger";

// Document 9, Phase 2 — Database: seed script. Document 11 §10 — MVP is a
// single-user, gated system; this seeds exactly that one OWNER user (and
// their default Settings row) so local development doesn't require waiting
// on a magic-link email. No business/feature data (Project, Note,
// Knowledge, ...) is seeded — that belongs to whoever exercises the
// Services once Phase 3 exists.

async function main(): Promise<void> {
  const owner = await prisma.user.upsert({
    where: { email: appConfig.ownerEmail },
    create: { email: appConfig.ownerEmail, role: "OWNER" },
    update: {},
  });

  await prisma.settings.upsert({
    where: { userId: owner.id },
    create: {
      userId: owner.id,
      defaultModel: aiConfig.defaultModel,
      aiTemperature: aiConfig.defaultTemperature,
    },
    update: {},
  });

  logger.info("Seed complete", { entity: "User", entityId: owner.id, email: owner.email });
}

main()
  .catch((error: unknown) => {
    logger.error("Seed failed", { error });
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
