import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import {
  analysisOutputSchema,
  canonicalPortfolioSnapshotSchema,
  narrativeOutputSchema,
  reportDocumentSchema,
  type AnalysisOutput,
  type CanonicalPortfolioSnapshot,
  type NarrativeOutput,
  type ReportDocument
} from "@/server/contracts";
import {
  CONTRACT_SCHEMA_VERSIONS,
  REPORT_DISCLAIMER_TEXT,
  REPORT_DISCLAIMER_VERSION
} from "@/server/shared/constants";

// ---------------------------------------------------------------------------
// Input type (matches the Prisma select for a completed report run)
// ---------------------------------------------------------------------------

export type ReportRunForDocumentAssembly = {
  id: string;
  userId: string;
  portfolioId: string;
  reportingCurrency: string;
  requestedAt: Date;
  marketDataProvider: string | null;
  narrativeProvider: string | null;
  narrativeModel: string | null;
  promptVersion: string | null;
  valuationAsOf: Date | null;
  canonicalSnapshot: Prisma.JsonValue | null;
  analysisOutput: Prisma.JsonValue | null;
  narrativeOutput: Prisma.JsonValue | null;
  portfolio: {
    name: string;
    description: string | null;
    baseCurrency: string;
  };
};

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class ReportDocumentAssemblyError extends Error {
  override name = "ReportDocumentAssemblyError";
}

// ---------------------------------------------------------------------------
// JSON parsing helpers
// ---------------------------------------------------------------------------

function parseCanonicalSnapshot(raw: Prisma.JsonValue | null): CanonicalPortfolioSnapshot {
  if (!raw) {
    throw new ReportDocumentAssemblyError(
      "Cannot assemble report document: canonical snapshot is missing."
    );
  }

  try {
    return canonicalPortfolioSnapshotSchema.parse(raw);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ReportDocumentAssemblyError(
        "Cannot assemble report document: canonical snapshot is invalid."
      );
    }
    throw error;
  }
}

function parseAnalysisOutput(raw: Prisma.JsonValue | null): AnalysisOutput {
  if (!raw) {
    throw new ReportDocumentAssemblyError(
      "Cannot assemble report document: analysis output is missing."
    );
  }

  try {
    return analysisOutputSchema.parse(raw);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ReportDocumentAssemblyError(
        "Cannot assemble report document: analysis output is invalid."
      );
    }
    throw error;
  }
}

function parseNarrativeOutput(raw: Prisma.JsonValue | null): NarrativeOutput {
  if (!raw) {
    throw new ReportDocumentAssemblyError(
      "Cannot assemble report document: narrative output is missing."
    );
  }

  try {
    return narrativeOutputSchema.parse(raw);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ReportDocumentAssemblyError(
        "Cannot assemble report document: narrative output is invalid."
      );
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

export function buildReportDocument(
  run: ReportRunForDocumentAssembly,
  generatedAt: Date
): ReportDocument {
  const canonicalSnapshot = parseCanonicalSnapshot(run.canonicalSnapshot);
  const analysisOutput = parseAnalysisOutput(run.analysisOutput);
  const narrativeOutput = parseNarrativeOutput(run.narrativeOutput);

  if (!run.marketDataProvider) {
    throw new ReportDocumentAssemblyError(
      "Cannot assemble report document: market data provider is missing."
    );
  }
  if (!run.narrativeProvider) {
    throw new ReportDocumentAssemblyError(
      "Cannot assemble report document: narrative provider is missing."
    );
  }
  if (!run.narrativeModel) {
    throw new ReportDocumentAssemblyError(
      "Cannot assemble report document: narrative model is missing."
    );
  }

  const generatedAtIso = generatedAt.toISOString();

  return reportDocumentSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSIONS.report,
    generatedAt: generatedAtIso,
    metadata: {
      runId: run.id,
      userId: run.userId,
      portfolioId: run.portfolioId,
      requestedAt: run.requestedAt.toISOString(),
      generatedAt: generatedAtIso,
      valuationAsOf: run.valuationAsOf?.toISOString() ?? null,
      reportingCurrency: run.reportingCurrency,
      marketDataProvider: run.marketDataProvider,
      narrativeProvider: run.narrativeProvider,
      narrativeModel: run.narrativeModel,
      canonicalSchemaVersion: canonicalSnapshot.schemaVersion,
      analysisSchemaVersion: analysisOutput.schemaVersion,
      narrativeSchemaVersion: narrativeOutput.schemaVersion,
      promptVersion: run.promptVersion
    },
    portfolio: {
      name: canonicalSnapshot.portfolioName,
      description: canonicalSnapshot.portfolioDescription,
      reportingCurrency: run.reportingCurrency
    },
    canonicalSnapshot,
    analysis: analysisOutput,
    narrative: narrativeOutput,
    compliance: {
      advisoryClassification: "NOT_INVESTMENT_ADVICE",
      disclaimerVersion: REPORT_DISCLAIMER_VERSION,
      disclaimerText: REPORT_DISCLAIMER_TEXT
    }
  });
}
