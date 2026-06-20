import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app/AppShell";
import { buildLoginProfileCompletionPath } from "@/lib/auth/redirect";
import { AuthenticationRequiredError } from "@/server/auth/authenticated-user";
import { loadAuthenticatedAppSession } from "@/server/auth/app-session";

type AppLayoutProps = {
  children: ReactNode;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workspace | Second Act",
  description: "Second Act authenticated workspace."
};

async function loadProfileForAppShell() {
  try {
    const { profile } = await loadAuthenticatedAppSession();

    return profile;
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/login?next=/app");
    }

    if (
      error &&
      typeof error === "object" &&
      (error as { code?: unknown }).code === "PROFILE_COMPLETION_REQUIRED"
    ) {
      redirect(buildLoginProfileCompletionPath("/app"));
    }

    throw error;
  }
}

export default async function AppLayout({ children }: AppLayoutProps) {
  const profile = await loadProfileForAppShell();

  return <AppShell profile={profile}>{children}</AppShell>;
}
