"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Document 11 §4, §8 — Email (magic-link) sign-in page. Public route
// (middleware.ts does not gate `/auth/**`).
export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await signIn("resend", { email, redirect: false });
    setStatus(result?.error ? "error" : "sent");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Sign in to KAIRO-Lite</h1>

      {status === "sent" ? (
        <p className="text-sm text-muted-foreground">Check your email for a sign-in link.</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-3">
          <Input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button type="submit">Send magic link</Button>
          {status === "error" ? (
            <p className="text-sm text-destructive">Something went wrong. Please try again.</p>
          ) : null}
        </form>
      )}
    </div>
  );
}
