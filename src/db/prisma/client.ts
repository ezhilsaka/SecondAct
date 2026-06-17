import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

import { getPrismaRuntimeEnv } from "@/db/prisma/runtime-env";

const globalForPrisma = globalThis as typeof globalThis & {
  __secondActPrisma?: PrismaClient;
  __secondActPgPool?: Pool;
};

let modulePrisma: PrismaClient | undefined;
let modulePgPool: Pool | undefined;

function readCachedPrisma() {
  return process.env.NODE_ENV !== "production" ? globalForPrisma.__secondActPrisma : modulePrisma;
}

function writeCachedPrisma(prismaClient: PrismaClient) {
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.__secondActPrisma = prismaClient;
  } else {
    modulePrisma = prismaClient;
  }
}

function readCachedPool() {
  return process.env.NODE_ENV !== "production" ? globalForPrisma.__secondActPgPool : modulePgPool;
}

function writeCachedPool(pool: Pool) {
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.__secondActPgPool = pool;
  } else {
    modulePgPool = pool;
  }
}

function getPgPool() {
  const cachedPool = readCachedPool();

  if (cachedPool) {
    return cachedPool;
  }

  const { DATABASE_URL: connectionString } = getPrismaRuntimeEnv();
  const pool = new Pool({
    connectionString
  });

  writeCachedPool(pool);

  return pool;
}

function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg(getPgPool())
  });
}

export function getPrismaClient() {
  const cachedPrisma = readCachedPrisma();

  if (cachedPrisma) {
    return cachedPrisma;
  }

  const prismaClient = createPrismaClient();

  writeCachedPrisma(prismaClient);

  return prismaClient;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const prismaClient = getPrismaClient();
    const value = Reflect.get(prismaClient, property, prismaClient);

    if (typeof value === "function") {
      return value.bind(prismaClient);
    }

    return value;
  },
  set(_target, property, value) {
    const prismaClient = getPrismaClient();

    return Reflect.set(prismaClient, property, value, prismaClient);
  }
});
