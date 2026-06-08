import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_LOGOUT_REDIRECT_PATH } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/server/auth/supabase-server";

async function signOutAndRedirect(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const response = NextResponse.redirect(new URL(DEFAULT_LOGOUT_REDIRECT_PATH, request.url));
  response.headers.set("Cache-Control", "private, no-store");

  return response;
}

export async function GET(request: NextRequest) {
  return signOutAndRedirect(request);
}

export async function POST(request: NextRequest) {
  return signOutAndRedirect(request);
}
