import { prisma, type Db } from "@/lib/db/client";

// Phase 3 requirement (transaction boundaries): "If a Service performs more
// than one write operation... execute the entire operation within a single
// Prisma transaction so the business operation is atomic. Repository
// interfaces should support participating in a shared transaction context
// rather than each creating independent transactions."
//
// Every repository accepts an optional `Db` in its constructor (defaulting
// to the global `prisma`). A Service that needs atomicity constructs its
// repositories *inside* this callback, passing `tx` to each — so every
// write in the callback shares one transaction, and no repository ever
// opens its own.
export async function withTransaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
  // Prisma's interactive-transaction client is structurally `Db` minus
  // `$extends`/`$transaction`/`$disconnect`/`$connect` (you can't nest
  // transactions or manage the connection from inside one) — a real,
  // narrower type, not `any`. Repositories only ever call model delegate
  // methods (`.project.findFirst()`, etc.), which the narrower type has in
  // full, so this cast is safe and Prisma's own docs describe this exact
  // pattern for typing shared transaction clients.
  return prisma.$transaction((tx) => fn(tx as unknown as Db));
}
