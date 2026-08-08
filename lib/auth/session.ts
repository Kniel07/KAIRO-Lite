import { auth } from "@/lib/auth";
import { UnauthorizedError } from "@/lib/utils/errors";

// Document 11 §7-8 — middleware only performs a cheap presence check;
// every Route Handler still resolves its own session to build the
// `ServiceContext` a Service needs (Document 11 §7's ownership-check
// requirement is the Service's job, but it needs `userId` to do it).
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }
  return session.user.id;
}
