import { z } from "zod";

import { CONTRACT_SCHEMA_VERSIONS } from "@/server/shared/constants";
import {
  dataQualityFlagSchema,
  isoTimestampStringSchema,
  nonEmptyStringSchema,
  nullableNonEmptyStringSchema,
  supportedCurrencySchema,
  uuidSchema
} from "@/server/shared/types";

const narrativeValueSchema = z.union([nonEmptyStringSchema, z.number().finite(), z.null()]);
const narrativeValueTypeSchema = z.enum(["currency", "percentage", "count", "ratio", "text"]);
const narrativeContextValueSchema = z.union([
  nonEmptyStringSchema,
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(nonEmptyStringSchema)
]);
const narrativeContextSchema = z.record(nonEmptyStringSchema, narrativeContextValueSchema);

/**
 * Minimal run metadata passed into the narrative provider. This stays scoped to
 * facts the explainer actually needs rather than re-sending raw pipeline data.
 */
export const narrativeGenerationContextSchema = z.object({
  runId: uuidSchema,
  portfolioId: uuidSchema,
  reportingCurrency: supportedCurrencySchema,
  valuationAsOf: isoTimestampStringSchema.nullable(),
  marketDataProvider: nonEmptyStringSchema,
  promptVersion: nullableNonEmptyStringSchema
});

export const narrativePortfolioContextSchema = z.object({
  name: nonEmptyStringSchema,
  reportingCurrency: supportedCurrencySchema,
  totalValueFormatted: nullableNonEmptyStringSchema.optional()
});

export const narrativeMetricInputSchema = z.object({
  name: nonEmptyStringSchema,
  displayName: nonEmptyStringSchema,
  rawValue: narrativeValueSchema.optional(),
  formattedValue: nullableNonEmptyStringSchema.optional(),
  valueType: narrativeValueTypeSchema,
  directionHint: nullableNonEmptyStringSchema.optional(),
  interpretationHint: nullableNonEmptyStringSchema.optional(),
  context: narrativeContextSchema.default({}),
  dataQualityFlags: z.array(dataQualityFlagSchema).default([])
});

export const narrativeInputSectionSchema = z.object({
  sectionKey: nonEmptyStringSchema,
  sectionTitle: nonEmptyStringSchema,
  sectionContext: narrativeContextSchema.default({}),
  metrics: z.array(narrativeMetricInputSchema)
});

/**
 * Prompt-ready narrative input built from deterministic pipeline outputs.
 */
export const generateNarrativeInputSchema = z.object({
  schemaVersion: z.literal(CONTRACT_SCHEMA_VERSIONS.narrative),
  generatedAt: isoTimestampStringSchema,
  context: narrativeGenerationContextSchema,
  portfolio: narrativePortfolioContextSchema,
  sections: z.array(narrativeInputSectionSchema),
  globalDataQualityFlags: z.array(dataQualityFlagSchema).default([])
});

export const narrativeMetricOutputSchema = z.object({
  name: nonEmptyStringSchema,
  displayName: nonEmptyStringSchema,
  narrative: nonEmptyStringSchema,
  takeaways: z.array(nonEmptyStringSchema).max(2).default([])
});

/**
 * Section-wise narrative output aligned with the analysis taxonomy and prompt
 * contract. The provider supplies the prose while the application supplies the
 * surrounding metadata.
 */
export const narrativeSectionSchema = z.object({
  sectionKey: nonEmptyStringSchema,
  sectionTitle: nonEmptyStringSchema,
  summaryNarrative: nonEmptyStringSchema,
  keyTakeaways: z.array(nonEmptyStringSchema).max(2).default([]),
  metrics: z.array(narrativeMetricOutputSchema)
});

export const narrativeOutputSchema = z.object({
  schemaVersion: z.literal(CONTRACT_SCHEMA_VERSIONS.narrative),
  generatedAt: isoTimestampStringSchema,
  provider: nonEmptyStringSchema,
  model: nonEmptyStringSchema,
  sections: z.array(narrativeSectionSchema),
  dataQualityFlags: z.array(dataQualityFlagSchema).default([])
});

export type NarrativeGenerationContext = z.infer<typeof narrativeGenerationContextSchema>;
export type NarrativePortfolioContext = z.infer<typeof narrativePortfolioContextSchema>;
export type NarrativeMetricInput = z.infer<typeof narrativeMetricInputSchema>;
export type NarrativeInputSection = z.infer<typeof narrativeInputSectionSchema>;
export type GenerateNarrativeInput = z.infer<typeof generateNarrativeInputSchema>;
export type NarrativeMetricOutput = z.infer<typeof narrativeMetricOutputSchema>;
export type NarrativeSection = z.infer<typeof narrativeSectionSchema>;
export type NarrativeOutput = z.infer<typeof narrativeOutputSchema>;
export type GenerateNarrativeResult = NarrativeOutput;
