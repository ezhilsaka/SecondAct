import { z } from "zod";

import { CONTRACT_SCHEMA_VERSIONS } from "@/server/shared/constants";
import {
  decimalStringSchema,
  isoTimestampStringSchema,
  nonEmptyStringSchema,
  supportedCurrencySchema
} from "@/server/shared/types";

function normalizeSearchQuery(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export const securitySearchQuerySchema = z.object({
  query: z
    .string()
    .transform(normalizeSearchQuery)
    .pipe(
      z
        .string()
        .min(2, "Search query must be at least 2 characters.")
        .max(40, "Search query must be 40 characters or fewer.")
        .regex(
          /^[A-Za-z0-9 .&-]+$/,
          "Search query can only contain letters, numbers, spaces, dots, hyphens, and ampersands."
        )
    )
});

export const securitySearchResultSchema = z.object({
  symbol: nonEmptyStringSchema.transform((value) => value.toUpperCase()),
  name: nonEmptyStringSchema.nullable().optional(),
  exchange: nonEmptyStringSchema.nullable().optional(),
  region: nonEmptyStringSchema.nullable().optional(),
  currency: supportedCurrencySchema.optional(),
  matchScore: decimalStringSchema.optional(),
  provider: nonEmptyStringSchema
});

export const securitySearchResponseSchema = z.object({
  results: z.array(securitySearchResultSchema)
});

export const securitySearchAdapterResponseSchema = securitySearchResponseSchema.extend({
  schemaVersion: z.literal(CONTRACT_SCHEMA_VERSIONS.securitySearch),
  provider: nonEmptyStringSchema,
  requestedAt: isoTimestampStringSchema
});

export type SecuritySearchQuery = z.infer<typeof securitySearchQuerySchema>;
export type SecuritySearchResult = z.infer<typeof securitySearchResultSchema>;
export type SecuritySearchResponse = z.infer<typeof securitySearchResponseSchema>;
export type SecuritySearchAdapterResponse = z.infer<
  typeof securitySearchAdapterResponseSchema
>;
