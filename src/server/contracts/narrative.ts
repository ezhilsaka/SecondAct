import { z } from "zod";

import { CONTRACT_SCHEMA_VERSIONS } from "@/server/shared/constants";
import { analysisOutputSchema } from "@/server/contracts/analysis";
import { canonicalPortfolioSnapshotSchema } from "@/server/contracts/canonical-model";
import {
  dataQualityFlagSchema,
  isoTimestampStringSchema,
  nonEmptyStringSchema,
  nullableNonEmptyStringSchema,
  supportedCurrencySchema,
  uuidSchema
} from "@/server/shared/types";

/**
 * Context passed into a narrative provider after the deterministic pipeline is complete.
 */
export const narrativeGenerationContextSchema = z.object({
  runId: uuidSchema,
  userId: uuidSchema,
  portfolioId: uuidSchema,
  reportingCurrency: supportedCurrencySchema,
  valuationAsOf: isoTimestampStringSchema.nullable(),
  marketDataProvider: nonEmptyStringSchema,
  promptVersion: nullableNonEmptyStringSchema
});

export const generateNarrativeInputSchema = z.object({
  schemaVersion: z.literal(CONTRACT_SCHEMA_VERSIONS.narrative),
  generatedAt: isoTimestampStringSchema,
  context: narrativeGenerationContextSchema,
  canonicalSnapshot: canonicalPortfolioSnapshotSchema,
  analysis: analysisOutputSchema
});

/**
 * Section-wise narrative output that stays aligned with the analysis section taxonomy.
 */
export const narrativeSectionSchema = z.object({
  sectionKey: nonEmptyStringSchema,
  sectionTitle: nonEmptyStringSchema,
  body: nonEmptyStringSchema,
  emphasis: z.enum(["positive", "negative", "neutral", "cautionary"]).optional()
});

export const narrativeOutputSchema = z.object({
  schemaVersion: z.literal(CONTRACT_SCHEMA_VERSIONS.narrative),
  generatedAt: isoTimestampStringSchema,
  provider: nonEmptyStringSchema,
  model: nonEmptyStringSchema,
  executiveSummary: nonEmptyStringSchema,
  sections: z.array(narrativeSectionSchema),
  keyTakeaways: z.array(nonEmptyStringSchema).default([]),
  cautionaryNotes: z.array(nonEmptyStringSchema).default([]),
  dataQualityFlags: z.array(dataQualityFlagSchema).default([])
});

export type NarrativeGenerationContext = z.infer<typeof narrativeGenerationContextSchema>;
export type GenerateNarrativeInput = z.infer<typeof generateNarrativeInputSchema>;
export type NarrativeSection = z.infer<typeof narrativeSectionSchema>;
export type NarrativeOutput = z.infer<typeof narrativeOutputSchema>;
export type GenerateNarrativeResult = NarrativeOutput;
