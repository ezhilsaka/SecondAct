import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/server/config";

const globalForSupabase = globalThis as typeof globalThis & {
  __secondActSupabaseAdmin?: SupabaseClient;
};

let moduleSupabaseAdmin: SupabaseClient | undefined;

function createSupabaseAdminClient(): SupabaseClient {
  const env = getServerEnv();

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

function readCachedSupabaseAdmin() {
  return process.env.NODE_ENV !== "production"
    ? globalForSupabase.__secondActSupabaseAdmin
    : moduleSupabaseAdmin;
}

function writeCachedSupabaseAdmin(client: SupabaseClient) {
  if (process.env.NODE_ENV !== "production") {
    globalForSupabase.__secondActSupabaseAdmin = client;
  } else {
    moduleSupabaseAdmin = client;
  }
}

export function getSupabaseAdminClient(): SupabaseClient {
  const cachedClient = readCachedSupabaseAdmin();

  if (cachedClient) {
    return cachedClient;
  }

  const client = createSupabaseAdminClient();

  writeCachedSupabaseAdmin(client);

  return client;
}

/**
 * Server-side Supabase client using the service role key.
 *
 * This is intentionally NOT the anon-key client. It is used for
 * server-side storage operations (PDF uploads) and other privileged
 * actions that run inside the worker or API layer.
 */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const client = getSupabaseAdminClient();
    const value = Reflect.get(client, property, client);

    if (typeof value === "function") {
      return value.bind(client);
    }

    return value;
  },
  set(_target, property, value) {
    const client = getSupabaseAdminClient();

    return Reflect.set(client, property, value, client);
  }
});
