import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { prisma } from "@/lib/db/client";
import { authConfig } from "@/config/auth";
import { appConfig } from "@/config/app";
import { sendVerificationEmail } from "@/lib/email/resend";

// Document 11 — Auth.js v5, database session strategy, Email (magic-link)
// provider via Resend, single-user MVP gate (Document 11 §10).
//
// This is the only module that constructs the Auth.js instance. Route
// handlers, middleware, and Server Components consume `auth`/`signIn`/
// `signOut`/`handlers` from here.

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: authConfig.secret,
  session: {
    strategy: "database",
    maxAge: authConfig.sessionMaxAgeSeconds,
    updateAge: authConfig.sessionUpdateAgeSeconds,
  },
  pages: {
    signIn: "/auth/signin",
  },
  providers: [
    Resend({
      apiKey: authConfig.resendApiKey,
      from: appConfig.emailFrom,
      sendVerificationRequest: async ({ identifier, url }) => {
        await sendVerificationEmail({ to: identifier, url });
      },
    }),
  ],
  callbacks: {
    // Document 11 §10 — single-user MVP gate. Rejects the magic link before
    // it is even sent to anyone but the configured owner email.
    async signIn({ user }) {
      if (!user.email) {
        return false;
      }
      return user.email.toLowerCase() === authConfig.ownerEmail.toLowerCase();
    },
  },
});
