import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  buildLoginProfileCompletionPath,
  readSearchParam,
  sanitizeRelativeRedirect
} from "@/lib/auth/redirect";

type ProfileSetupPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Complete profile | Second Act",
  description: "Complete your Second Act profile."
};

export default async function ProfileSetupPage({ searchParams }: ProfileSetupPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeRelativeRedirect(readSearchParam(params?.next));
  const errorCode = readSearchParam(params?.error);

  redirect(buildLoginProfileCompletionPath(nextPath, errorCode));
}
