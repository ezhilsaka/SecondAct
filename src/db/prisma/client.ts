import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to initialize PrismaClient.");
}

const globalForPrisma = globalThis as typeof globalThis & {
  __secondActPrisma?: PrismaClient;
  __secondActPgPool?: Pool;
};

function createPrismaClient() {
  const pool =
    globalForPrisma.__secondActPgPool ??
    new Pool({
      connectionString
    });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({
    adapter
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.__secondActPgPool = pool;
  }

  return prisma;
}

export const prisma = globalForPrisma.__secondActPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__secondActPrisma = prisma;
}
