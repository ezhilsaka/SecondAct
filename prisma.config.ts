import "dotenv/config";

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "src/db/prisma/schema.prisma",
  migrations: {
    path: "src/db/prisma/migrations"
  },
  datasource: {
    // Supabase session pooler is the verified connection path for local dev and Vercel.
    // DIRECT_URL remains in env for future IPv6-capable admin workflows.
    url: env("DATABASE_URL")
  }
});
