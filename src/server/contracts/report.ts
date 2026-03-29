import { z } from "zod";

import {
  CONTRACT_SCHEMA_VERSIONS,
  REPORT_DISCLAIMER_TEXT,
  REPORT_DISCLAIMER_VERSION
} from "@/server/shared/constants";
import { analysisOutputSchema } from "@/server/contracts/analysis";
import { canonicalPortfolioSnapshotSchema } from "@/server/contracts/canonical-model";
import { narrativeOutputSchema } from "@/server/contracts/narrative";
import {
  isoTimestampStringSchema,
  nonEmptyStringSchema,
  nullableNonEmptyStringSchema,
  supportedCurrencySchema,
  uuidSchema
} from "@/server/shared/types";

/**
 * Shared metadata attached to a report run across generation stages.
 */
export const reportMetadataSchema = z.object({
  runId: uuidSchema,
  userId: uuidSchema,
  portfolioId: uuidSchema,
  requestedAt: isoTimestampStringSchema,
  generatedAt: isoTimestampStringSchema,
  valuationAsOf: isoTimestampStringSchema.nullable(),
  reportingCurrency: supportedCurrencySchema,
  marketDataProvider: nonEmptyStringSchema,
  narrativeProvider: nonEmptyStringSchema,
  narrativeModel: nonEmptyStringSchema,
  canonicalSchemaVersion: nonEmptyStringSchema,
  analysisSchemaVersion: nonEmptyStringSchema,
  narrativeSchemaVersion: nonEmptyStringSchema,
  promptVersion: nullableNonEmptyStringSchema
});

export const reportPortfolioContextSchema = z.object({
  name: nonEmptyStringSchema,
  description: nullableNonEmptyStringSchema,
  reportingCurrency: supportedCurrencySchema
});

/**
 * System-owned compliance block kept out of provider-controlled outputs.
 */
export const reportComplianceSchema = z.object({
  advisoryClassification: z.literal("NOT_INVESTMENT_ADVICE"),
  disclaimerVersion: z.literal(REPORT_DISCLAIMER_VERSION),
  disclaimerText: z.literal(REPORT_DISCLAIMER_TEXT)
});

/**
 * Final renderer-ready document assembled from validated pipeline outputs.
 */
export const reportDocumentSchema = z.object({
  schemaVersion: z.literal(CONTRACT_SCHEMA_VERSIONS.report),
  generatedAt: isoTimestampStringSchema,
  metadata: reportMetadataSchema,
  portfolio: reportPortfolioContextSchema,
  canonicalSnapshot: canonicalPortfolioSnapshotSchema,
  analysis: analysisOutputSchema,
  narrative: narrativeOutputSchema,
  compliance: reportComplianceSchema
});

export const renderPdfResultSchema = z.object({
  filePath: nonEmptyStringSchema,
  mimeType: z.literal("application/pdf"),
  byteSize: z.number().int().nonnegative().optional(),
  checksumSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/i, "Expected a SHA-256 hex digest.")
    .optional()
});

export type ReportMetadata = z.infer<typeof reportMetadataSchema>;
export type ReportPortfolioContext = z.infer<typeof reportPortfolioContextSchema>;
export type ReportCompliance = z.infer<typeof reportComplianceSchema>;
export type ReportDocument = z.infer<typeof reportDocumentSchema>;
export type RenderPdfInput = ReportDocument;
export type RenderPdfResult = z.infer<typeof renderPdfResultSchema>;
