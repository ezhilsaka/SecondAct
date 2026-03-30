import { loadEnvConfig } from "@next/env";

import { defineConfig } from "prisma/config";

loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL?.trim();

export default defineConfig({
  schema: "src/db/prisma/schema.prisma",
  migrations: {
    path: "src/db/prisma/migrations"
  },
  // For generate/typecheck-only build paths (for example Vercel install hooks),
  // allow Prisma config to load without a database URL.
  // Runtime DB access still requires DATABASE_URL and is validated separately.
  datasource: databaseUrl
    ? {
        // Supabase session pooler is the verified connection path for local dev and Vercel.
        // DIRECT_URL remains in env for future IPv6-capable admin workflows.
        url: databaseUrl
      }
    : undefined
});
