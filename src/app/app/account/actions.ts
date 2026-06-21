"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/server/auth/supabase-server";
import {
  ProfileCompletionRequiredError,
  updateAuthenticatedUserProfile
} from "@/server/auth/profile-bootstrap";

const ACCOUNT_PATH = "/app/account";

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function buildAccountRedirect(key: "notice" | "error", value: string): string {
  const params = new URLSearchParams({ [key]: value });
  return `${ACCOUNT_PATH}?${params.toString()}`;
}

export async function updateProfileNameFromForm(formData: FormData) {
  const firstName = readFormString(formData, "firstName");
  const lastName = readFormString(formData, "lastName");

  if (!firstName || !lastName) {
    redirect(buildAccountRedirect("error", "profile_validation_error"));
  }

  const user = await requireAuthenticatedUser();

  try {
    await updateAuthenticatedUserProfile(user, {
      firstName,
      lastName
    });

    revalidatePath("/app");
    revalidatePath(ACCOUNT_PATH);
  } catch (error) {
    if (error instanceof ProfileCompletionRequiredError) {
      redirect(buildAccountRedirect("error", "profile_validation_error"));
    }

    redirect(buildAccountRedirect("error", "profile_update_failed"));
  }

  redirect(buildAccountRedirect("notice", "profile_updated"));
}
