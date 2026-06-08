import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase/config";
import {
  getAuthenticatedUserFromClaims,
  type AuthenticatedUser
} from "@/server/auth/authenticated-user";

export function createSupabaseProxyClient(
  request: NextRequest,
  response: NextResponse
): SupabaseClient {
  const { url, anonKey } = getSupabasePublicConfig();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      }
    }
  });
}

export async function getAuthenticatedUserForProxy(
  request: NextRequest,
  response: NextResponse
): Promise<AuthenticatedUser | null> {
  const supabase = createSupabaseProxyClient(request, response);
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data) {
    return null;
  }

  return getAuthenticatedUserFromClaims(data.claims);
}

export async function updateSupabaseSession(
  request: NextRequest
): Promise<{ response: NextResponse; user: AuthenticatedUser | null }> {
  const response = NextResponse.next({ request });
  const user = await getAuthenticatedUserForProxy(request, response);

  return { response, user };
}
