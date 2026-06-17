import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };
const prismaGlobals = globalThis as typeof globalThis & {
  __secondActPgPool?: unknown;
  __secondActPrisma?: unknown;
};

function resetPrismaGlobals() {
  delete prismaGlobals.__secondActPgPool;
  delete prismaGlobals.__secondActPrisma;
}

function applyEnvWithoutDatabaseUrl() {
  process.env = {
    NODE_ENV: "test"
  };
  delete process.env.DATABASE_URL;
  delete process.env.DIRECT_URL;
}

describe("Prisma client module", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    resetPrismaGlobals();
    vi.doUnmock("@next/env");
    vi.resetModules();
  });

  it("can be imported without a Prisma runtime environment", async () => {
    vi.doMock("@next/env", () => ({ loadEnvConfig: vi.fn() }));
    applyEnvWithoutDatabaseUrl();

    await expect(import("@/db/prisma/client")).resolves.toHaveProperty("prisma");
  });

  it("validates Prisma runtime environment when the real client is requested", async () => {
    vi.doMock("@next/env", () => ({ loadEnvConfig: vi.fn() }));
    applyEnvWithoutDatabaseUrl();

    const { getPrismaClient } = await import("@/db/prisma/client");

    expect(() => getPrismaClient()).toThrow(
      "Invalid Prisma runtime environment:\n- Invalid input: expected string, received undefined"
    );
  });
});
