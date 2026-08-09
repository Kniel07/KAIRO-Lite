import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";
import { SearchRepository } from "@/lib/db/repositories/SearchRepository";

// Document 13 §28 (Amendment 26, Phase 7.5) — Phase 7 QA Report finding Q1:
// CI never exercised a real Postgres instance, so the Phase 6 raw-SQL
// parameter-type-inference bug (`searchKnowledgeForContext` throwing
// `invalid input syntax for type integer: "0.3"` on a float bind) shipped
// past every static check (TypeScript, ESLint, `prisma validate`) and was
// only caught by manual, ad hoc verification during that phase. This test
// exercises both `SearchRepository` raw-SQL methods against a real
// database so a regression of that class fails CI, not just a human's
// memory.
//
// Requires a live, migrated `DATABASE_URL` — run via `npm run
// test:integration`, kept out of the default `npm test` (unit) run and
// `tests/unit/**` glob, since most local/CI environments don't have
// Postgres available by default (mirrors Document 13 §19's existing CI
// scoping rationale for why the unit suite never needed one).

describe("SearchRepository (integration)", () => {
  const repository = new SearchRepository();
  const marker = `zzintegrationtest${Date.now()}`;
  const knowledgeIds: string[] = [];
  let ownerId: string;
  let createdOwner = false;

  beforeAll(async () => {
    // `Project.ownerId` is required; reuse an existing user if one already
    // exists (e.g. the single MVP owner) rather than assuming a clean
    // database, since this suite may run against a dev database with real
    // data already in it. Only clean up the user in `afterAll` if this
    // suite created it.
    const existingOwner = await prisma.user.findFirst();
    if (existingOwner) {
      ownerId = existingOwner.id;
    } else {
      const created = await prisma.user.create({ data: { email: `${marker}@example.com` } });
      ownerId = created.id;
      createdOwner = true;
    }

    const alpha = await prisma.knowledge.create({
      data: {
        title: `${marker} Alpha`,
        markdown: `Integration test content mentioning ${marker} for full-text search.`,
        category: "general",
        confidence: 0.5,
        status: "VALIDATED",
      },
    });
    const beta = await prisma.knowledge.create({
      data: {
        title: `${marker} Beta`,
        markdown: `A second row also mentioning ${marker}, for ranking comparisons.`,
        category: "general",
        confidence: 0.5,
        status: "VALIDATED",
      },
    });
    knowledgeIds.push(alpha.id, beta.id);
  });

  afterAll(async () => {
    await prisma.knowledge.deleteMany({ where: { id: { in: knowledgeIds } } });
    if (createdOwner) {
      await prisma.user.delete({ where: { id: ownerId } });
    }
    await prisma.$disconnect();
  });

  it("searchKnowledge finds seeded rows by full-text query", async () => {
    const result = await repository.searchKnowledge({ query: marker });
    const foundIds = result.items.map((item) => item.id);
    expect(foundIds).toEqual(expect.arrayContaining(knowledgeIds));
  });

  it("searchKnowledgeForContext applies the Active-Project and Recency boosts without a Postgres type error", async () => {
    // This is the exact call shape that threw a Postgres type-inference
    // error before the Phase 6 `::float8` cast fix — a regression here is a
    // real database-level failure, not a mock/fake gap.
    const results = await repository.searchKnowledgeForContext({
      query: marker,
      limit: 5,
    });
    const foundIds = results.map((entry) => entry.id);
    expect(foundIds).toEqual(expect.arrayContaining(knowledgeIds));
    expect(
      results.every((entry) => typeof entry.rank === "number" && Number.isFinite(entry.rank)),
    ).toBe(true);
  });

  it("searchKnowledgeForContext boosts a same-project match above an equally-relevant global one", async () => {
    const project = await prisma.project.create({
      data: {
        name: `${marker}-project`,
        slug: `${marker}-project`,
        status: "ACTIVE",
        priority: "MEDIUM",
        owner: { connect: { id: ownerId } },
      },
    });
    const scoped = await prisma.knowledge.create({
      data: {
        title: `${marker} Scoped`,
        markdown: `Project-scoped row mentioning ${marker}boost for affinity ranking.`,
        category: "general",
        confidence: 0.5,
        status: "VALIDATED",
        projectId: project.id,
      },
    });
    const global = await prisma.knowledge.create({
      data: {
        title: `${marker} Global`,
        markdown: `Global row mentioning ${marker}boost for affinity ranking.`,
        category: "general",
        confidence: 0.5,
        status: "VALIDATED",
      },
    });

    try {
      const results = await repository.searchKnowledgeForContext({
        query: `${marker}boost`,
        projectId: project.id,
        limit: 5,
      });
      const scopedRank = results.find((entry) => entry.id === scoped.id)?.rank;
      const globalRank = results.find((entry) => entry.id === global.id)?.rank;
      expect(scopedRank).toBeDefined();
      expect(globalRank).toBeDefined();
      expect(scopedRank as number).toBeGreaterThan(globalRank as number);
    } finally {
      await prisma.knowledge.deleteMany({ where: { id: { in: [scoped.id, global.id] } } });
      await prisma.project.delete({ where: { id: project.id } });
    }
  });
});
