import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { serverEnv } from "@/server/config";

const globalForSupabase = globalThis as typeof globalThis & {
  __secondActSupabaseAdmin?: SupabaseClient;
};

function createSupabaseAdminClient(): SupabaseClient {
  return createClient(serverEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

/**
 * Server-side Supabase client using the service role key.
 *
 * This is intentionally NOT the anon-key client. It is used for
 * server-side storage operations (PDF uploads) and other privileged
 * actions that run inside the worker or API layer.
 */
export const supabaseAdmin =
  globalForSupabase.__secondActSupabaseAdmin ?? createSupabaseAdminClient();

if (process.env.NODE_ENV !== "production") {
  globalForSupabase.__secondActSupabaseAdmin = supabaseAdmin;
}
