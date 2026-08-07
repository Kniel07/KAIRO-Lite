import { Resend } from "resend";
import { authConfig } from "@/config/auth";
import { appConfig } from "@/config/app";
import { logger } from "@/lib/logger";

// Document 11 §4 — Resend powers Auth.js's Email (magic-link) provider.
// This is the only module that touches the Resend SDK directly
// (Document 7 §9's "provider-specific code stays isolated" principle,
// applied here to the email infrastructure rather than an AI provider).

const resend = new Resend(authConfig.resendApiKey);

export async function sendVerificationEmail(params: { to: string; url: string }): Promise<void> {
  const { error } = await resend.emails.send({
    from: appConfig.emailFrom,
    to: params.to,
    subject: `Sign in to ${appConfig.name}`,
    html: `<p>Click the link below to sign in to ${appConfig.name}.</p><p><a href="${params.url}">Sign in</a></p><p>If you did not request this email, you can safely ignore it.</p>`,
  });

  if (error) {
    logger.error("Failed to send verification email", { provider: "resend" });
    throw new Error("Could not send verification email.");
  }
}
