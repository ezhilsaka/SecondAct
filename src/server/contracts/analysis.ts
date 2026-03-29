import { z } from "zod";

import { CONTRACT_SCHEMA_VERSIONS } from "@/server/shared/constants";
import {
  dataQualityFlagSchema,
  isoTimestampStringSchema,
  nonEmptyStringSchema,
  nullableDecimalStringSchema,
  uuidSchema
} from "@/server/shared/types";

const analysisValueSchema = z.union([nonEmptyStringSchema, z.number().finite(), z.null()]);
const analysisUnitSchema = z.enum(["currency", "percentage", "count", "ratio", "text"]);
const analysisEmphasisSchema = z.enum(["positive", "negative", "neutral", "cautionary"]);

/**
 * Stable top-level summary surfaced across report channels regardless of section taxonomy.
 */
export const analysisSummarySchema = z.object({
  totalMarketValue: nullableDecimalStringSchema,
  totalCostBasis: nullableDecimalStringSchema,
  totalUnrealizedPnL: nullableDecimalStringSchema,
  totalUnrealizedPnLPercent: nullableDecimalStringSchema,
  holdingCount: z.number().int().nonnegative(),
  gainersCount: z.number().int().nonnegative(),
  losersCount: z.number().int().nonnegative(),
  concentrationHhi: nullableDecimalStringSchema,
  largestPositionWeightPercent: nullableDecimalStringSchema
});

/**
 * Generic metric block that can be reused across evolving analysis taxonomy sections.
 */
export const analysisMetricSchema = z.object({
  key: nonEmptyStringSchema,
  label: nonEmptyStringSchema,
  value: analysisValueSchema,
  unit: analysisUnitSchema.optional(),
  displayValue: nonEmptyStringSchema.optional(),
  emphasis: analysisEmphasisSchema.optional()
});

export const analysisTableColumnSchema = z.object({
  key: nonEmptyStringSchema,
  label: nonEmptyStringSchema,
  unit: analysisUnitSchema.optional()
});

export const analysisTableCellSchema = z.object({
  columnKey: nonEmptyStringSchema,
  value: analysisValueSchema,
  displayValue: nonEmptyStringSchema.optional()
});

export const analysisTableRowSchema = z.object({
  rowKey: nonEmptyStringSchema,
  label: nonEmptyStringSchema.optional(),
  cells: z.array(analysisTableCellSchema)
});

export const analysisTableSchema = z.object({
  tableKey: nonEmptyStringSchema,
  title: nonEmptyStringSchema,
  columns: z.array(analysisTableColumnSchema).min(1),
  rows: z.array(analysisTableRowSchema)
});

/**
 * Taxonomy-aligned section payload. Section keys and titles remain product-owned,
 * which keeps the contract extensible without rewriting the whole analysis model.
 */
export const analysisSectionSchema = z.object({
  sectionKey: nonEmptyStringSchema,
  sectionTitle: nonEmptyStringSchema,
  order: z.number().int().nonnegative(),
  summary: nonEmptyStringSchema.optional(),
  metrics: z.array(analysisMetricSchema).default([]),
  findings: z.array(nonEmptyStringSchema).default([]),
  tables: z.array(analysisTableSchema).default([]),
  dataQualityFlags: z.array(dataQualityFlagSchema).default([])
});

/**
 * Deterministic analysis output produced from the canonical portfolio snapshot.
 */
export const analysisOutputSchema = z.object({
  schemaVersion: z.literal(CONTRACT_SCHEMA_VERSIONS.analysis),
  generatedAt: isoTimestampStringSchema,
  runId: uuidSchema,
  summary: analysisSummarySchema,
  sections: z.array(analysisSectionSchema),
  methodologyNotes: z.array(nonEmptyStringSchema).default([]),
  dataQualityFlags: z.array(dataQualityFlagSchema).default([])
});

export type AnalysisValue = z.infer<typeof analysisValueSchema>;
export type AnalysisSummary = z.infer<typeof analysisSummarySchema>;
export type AnalysisMetric = z.infer<typeof analysisMetricSchema>;
export type AnalysisTableColumn = z.infer<typeof analysisTableColumnSchema>;
export type AnalysisTableCell = z.infer<typeof analysisTableCellSchema>;
export type AnalysisTableRow = z.infer<typeof analysisTableRowSchema>;
export type AnalysisTable = z.infer<typeof analysisTableSchema>;
export type AnalysisSection = z.infer<typeof analysisSectionSchema>;
export type AnalysisOutput = z.infer<typeof analysisOutputSchema>;
