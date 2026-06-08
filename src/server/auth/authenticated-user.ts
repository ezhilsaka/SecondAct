import type { JwtPayload } from "@supabase/supabase-js";

import { uuidSchema, type Uuid } from "@/server/shared/types";

export type AuthenticatedUser = {
  id: Uuid;
  email: string | null;
  claims: JwtPayload;
};

export class AuthenticationRequiredError extends Error {
  readonly code = "AUTHENTICATION_REQUIRED";

  constructor(message = "Authentication required.") {
    super(message);
    this.name = "AuthenticationRequiredError";
  }
}

export function getAuthenticatedUserFromClaims(claims: JwtPayload): AuthenticatedUser | null {
  const userId = uuidSchema.safeParse(claims.sub);

  if (!userId.success) {
    return null;
  }

  return {
    id: userId.data,
    email: typeof claims.email === "string" && claims.email.trim().length > 0 ? claims.email : null,
    claims
  };
}
