export type SupabasePublicConfig = {
  url: string;
  anonKey: string;
};

type SupabasePublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
} & Record<string, string | undefined>;

function readRequiredEnv(env: SupabasePublicEnv, name: keyof SupabasePublicEnv): string {
  const value = env[name];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required for Supabase auth clients.`);
  }

  return value;
}

function readSupabasePublicEnv(): SupabasePublicEnv {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  };
}

export function getSupabasePublicConfig(
  env: SupabasePublicEnv = readSupabasePublicEnv()
): SupabasePublicConfig {
  const url = readRequiredEnv(env, "NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = readRequiredEnv(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY");

  try {
    new URL(url);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid URL.");
  }

  return { url, anonKey };
}
