import { NextResponse } from "next/server";

import {
  AuthenticationRequiredError,
  type AuthenticatedUser
} from "@/server/auth/authenticated-user";
import { requireAuthenticatedUser } from "@/server/auth/supabase-server";
import type { Uuid } from "@/server/shared/types";

const API_UNAUTHORIZED_ERROR = {
  error: {
    code: "UNAUTHORIZED",
    message: "Authentication is required."
  }
};

export function buildApiUnauthorizedResponse(): NextResponse {
  return NextResponse.json(API_UNAUTHORIZED_ERROR, { status: 401 });
}

export async function getAuthenticatedApiUser(): Promise<AuthenticatedUser | null> {
  try {
    return await requireAuthenticatedUser();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return null;
    }

    throw error;
  }
}

export async function getAuthenticatedApiUserId(): Promise<Uuid | null> {
  const user = await getAuthenticatedApiUser();

  return user?.id ?? null;
}
