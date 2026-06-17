import { loadEnvConfig } from "@next/env";
import { z } from "zod";

loadEnvConfig(process.cwd());

const optionalEnvString = z.preprocess((value) => {
  if (typeof value === "string" && value.trim().length === 0) {
    return undefined;
  }

  return value;
}, z.string().min(1).optional());

const prismaRuntimeEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required for Prisma runtime."),
  DIRECT_URL: optionalEnvString
});

/**
 * Minimal database runtime env so Prisma client setup does not depend on unrelated server env.
 */
export function getPrismaRuntimeEnv() {
  const parsedRuntimeEnv = prismaRuntimeEnvSchema.safeParse(process.env);

  if (!parsedRuntimeEnv.success) {
    const messages = parsedRuntimeEnv.error.issues.map((issue) => `- ${issue.message}`).join("\n");

    throw new Error(`Invalid Prisma runtime environment:\n${messages}`);
  }

  return parsedRuntimeEnv.data;
}
