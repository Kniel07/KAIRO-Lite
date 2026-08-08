"use client";

import { useTheme } from "next-themes";
import { signOut, useSession } from "next-auth/react";
import { Moon, Sun, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

// Document 9 Phase 4 deliverable: "Layout." A consistent top bar across
// every authenticated page — who's signed in, a theme toggle (Document 10
// §5.11's Theme preference), and sign-out, so those aren't buried
// per-page.
export function Header() {
  const { data: session } = useSession();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-6">
      <span className="text-sm text-muted-foreground">{session?.user?.email}</span>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          aria-label={resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void signOut({ callbackUrl: ROUTES.signIn })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </header>
  );
}
