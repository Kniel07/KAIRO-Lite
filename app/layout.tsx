import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { SessionProvider } from "@/providers/SessionProvider";
import { AIProvider } from "@/providers/AIProvider";

export const metadata: Metadata = {
  title: "KAIRO-Lite",
  description: "An AI-native Personal Operating System.",
};

// Document 5 §3 — app/ contains routing and composition only, no business
// logic (Document 2 §3, Presentation Layer).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <SessionProvider>
            <QueryProvider>
              <AIProvider>{children}</AIProvider>
            </QueryProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
