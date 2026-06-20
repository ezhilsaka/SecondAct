import { cache } from "react";

import type { AppUserProfile } from "@/server/auth/profile-bootstrap";
import { bootstrapAuthenticatedUserProfile } from "@/server/auth/profile-bootstrap";
import { requireAuthenticatedUser } from "@/server/auth/supabase-server";
import type { AuthenticatedUser } from "@/server/auth/authenticated-user";

export type AuthenticatedAppSession = {
  user: AuthenticatedUser;
  profile: AppUserProfile;
};

export const loadAuthenticatedAppSession = cache(async (): Promise<AuthenticatedAppSession> => {
  const user = await requireAuthenticatedUser();
  const { profile } = await bootstrapAuthenticatedUserProfile(user);

  return {
    user,
    profile
  };
});

export async function requireAuthenticatedAppUser(): Promise<AuthenticatedUser> {
  const { user } = await loadAuthenticatedAppSession();

  return user;
}
