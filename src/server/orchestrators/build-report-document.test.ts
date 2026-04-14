import { describe, expect, it } from "vitest";

import { buildContractFixturePayloads } from "@/server/contracts/fixtures";
import {
  CONTRACT_SCHEMA_VERSIONS,
  REPORT_DISCLAIMER_TEXT,
  REPORT_DISCLAIMER_VERSION
} from "@/server/shared/constants";

import {
  buildReportDocument,
  ReportDocumentAssemblyError,
  type ReportRunForDocumentAssembly
} from "./build-report-document";

const RUN_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const PORTFOLIO_ID = "33333333-3333-4333-8333-333333333333";
const GENERATED_AT = new Date("2026-04-11T12:00:00.000Z");
const REQUESTED_AT = new Date("2026-04-11T11:55:00.000Z");
const VALUATION_AS_OF = new Date("2026-04-10T20:00:00.000Z");

function buildCompletedRun(): ReportRunForDocumentAssembly {
  const { canonicalSnapshot, analysisOutput, narrativeOutput } = buildContractFixturePayloads();

  return {
    id: RUN_ID,
    userId: USER_ID,
    portfolioId: PORTFOLIO_ID,
    reportingCurrency: "USD",
    requestedAt: REQUESTED_AT,
    marketDataProvider: "yfinance",
    narrativeProvider: "openai-compatible",
    narrativeModel: "local-mistral",
    promptVersion: "narrative-explainer.v1",
    valuationAsOf: VALUATION_AS_OF,
    canonicalSnapshot: JSON.parse(JSON.stringify(canonicalSnapshot)),
    analysisOutput: JSON.parse(JSON.stringify(analysisOutput)),
    narrativeOutput: JSON.parse(JSON.stringify(narrativeOutput)),
    portfolio: {
      name: "Phase 1 Demo Portfolio",
      description: "Seeded portfolio for report pipeline validation.",
      baseCurrency: "USD"
    }
  };
}

describe("buildReportDocument", () => {
  it("assembles a validated ReportDocument from a completed run", () => {
    const run = buildCompletedRun();
    const doc = buildReportDocument(run, GENERATED_AT);

    expect(doc.schemaVersion).toBe(CONTRACT_SCHEMA_VERSIONS.report);
    expect(doc.generatedAt).toBe(GENERATED_AT.toISOString());
  });

  it("maps metadata correctly from the run record", () => {
    const run = buildCompletedRun();
    const doc = buildReportDocument(run, GENERATED_AT);

    expect(doc.metadata).toEqual(
      expect.objectContaining({
        runId: RUN_ID,
        userId: USER_ID,
        portfolioId: PORTFOLIO_ID,
        requestedAt: REQUESTED_AT.toISOString(),
        generatedAt: GENERATED_AT.toISOString(),
        valuationAsOf: VALUATION_AS_OF.toISOString(),
        reportingCurrency: "USD",
        marketDataProvider: "yfinance",
        narrativeProvider: "openai-compatible",
        narrativeModel: "local-mistral",
        promptVersion: "narrative-explainer.v1"
      })
    );
  });

  it("propagates schema versions from each pipeline stage", () => {
    const run = buildCompletedRun();
    const doc = buildReportDocument(run, GENERATED_AT);

    expect(doc.metadata.canonicalSchemaVersion).toBe(CONTRACT_SCHEMA_VERSIONS.canonicalModel);
    expect(doc.metadata.analysisSchemaVersion).toBe(CONTRACT_SCHEMA_VERSIONS.analysis);
    expect(doc.metadata.narrativeSchemaVersion).toBe(CONTRACT_SCHEMA_VERSIONS.narrative);
  });

  it("derives portfolio context from the canonical snapshot", () => {
    const run = buildCompletedRun();
    const doc = buildReportDocument(run, GENERATED_AT);

    expect(doc.portfolio.name).toBe("Phase 1 Demo Portfolio");
    expect(doc.portfolio.description).toBe("Seeded portfolio for report pipeline validation.");
    expect(doc.portfolio.reportingCurrency).toBe("USD");
  });

  it("uses run.reportingCurrency for portfolio context, not baseCurrency", () => {
    const run = buildCompletedRun();
    // Portfolio baseCurrency is USD, but run requests CAD
    run.reportingCurrency = "CAD";
    const doc = buildReportDocument(run, GENERATED_AT);

    // metadata should match the run's reportingCurrency
    expect(doc.metadata.reportingCurrency).toBe("CAD");
    // portfolio context should also use the run's reportingCurrency, NOT the baseCurrency
    expect(doc.portfolio.reportingCurrency).toBe("CAD");
  });

  it("attaches the system-owned compliance block", () => {
    const run = buildCompletedRun();
    const doc = buildReportDocument(run, GENERATED_AT);

    expect(doc.compliance).toEqual({
      advisoryClassification: "NOT_INVESTMENT_ADVICE",
      disclaimerVersion: REPORT_DISCLAIMER_VERSION,
      disclaimerText: REPORT_DISCLAIMER_TEXT
    });
  });

  it("handles null valuationAsOf", () => {
    const run = buildCompletedRun();
    run.valuationAsOf = null;
    const doc = buildReportDocument(run, GENERATED_AT);

    expect(doc.metadata.valuationAsOf).toBeNull();
  });

  it("handles null promptVersion", () => {
    const run = buildCompletedRun();
    run.promptVersion = null;
    const doc = buildReportDocument(run, GENERATED_AT);

    expect(doc.metadata.promptVersion).toBeNull();
  });

  it("throws when canonical snapshot is missing", () => {
    const run = buildCompletedRun();
    run.canonicalSnapshot = null;

    expect(() => buildReportDocument(run, GENERATED_AT)).toThrow(ReportDocumentAssemblyError);
    expect(() => buildReportDocument(run, GENERATED_AT)).toThrow("canonical snapshot is missing");
  });

  it("throws when analysis output is missing", () => {
    const run = buildCompletedRun();
    run.analysisOutput = null;

    expect(() => buildReportDocument(run, GENERATED_AT)).toThrow(ReportDocumentAssemblyError);
    expect(() => buildReportDocument(run, GENERATED_AT)).toThrow("analysis output is missing");
  });

  it("throws when narrative output is missing", () => {
    const run = buildCompletedRun();
    run.narrativeOutput = null;

    expect(() => buildReportDocument(run, GENERATED_AT)).toThrow(ReportDocumentAssemblyError);
    expect(() => buildReportDocument(run, GENERATED_AT)).toThrow("narrative output is missing");
  });

  it("throws when market data provider is missing", () => {
    const run = buildCompletedRun();
    run.marketDataProvider = null;

    expect(() => buildReportDocument(run, GENERATED_AT)).toThrow(ReportDocumentAssemblyError);
    expect(() => buildReportDocument(run, GENERATED_AT)).toThrow("market data provider is missing");
  });

  it("throws when narrative provider is missing", () => {
    const run = buildCompletedRun();
    run.narrativeProvider = null;

    expect(() => buildReportDocument(run, GENERATED_AT)).toThrow(ReportDocumentAssemblyError);
    expect(() => buildReportDocument(run, GENERATED_AT)).toThrow("narrative provider is missing");
  });

  it("throws when narrative model is missing", () => {
    const run = buildCompletedRun();
    run.narrativeModel = null;

    expect(() => buildReportDocument(run, GENERATED_AT)).toThrow(ReportDocumentAssemblyError);
    expect(() => buildReportDocument(run, GENERATED_AT)).toThrow("narrative model is missing");
  });

  it("throws when canonical snapshot JSON is structurally invalid", () => {
    const run = buildCompletedRun();
    run.canonicalSnapshot = { invalid: true };

    expect(() => buildReportDocument(run, GENERATED_AT)).toThrow(ReportDocumentAssemblyError);
    expect(() => buildReportDocument(run, GENERATED_AT)).toThrow("canonical snapshot is invalid");
  });

  it("throws when analysis output JSON is structurally invalid", () => {
    const run = buildCompletedRun();
    run.analysisOutput = { invalid: true };

    expect(() => buildReportDocument(run, GENERATED_AT)).toThrow(ReportDocumentAssemblyError);
    expect(() => buildReportDocument(run, GENERATED_AT)).toThrow("analysis output is invalid");
  });

  it("throws when narrative output JSON is structurally invalid", () => {
    const run = buildCompletedRun();
    run.narrativeOutput = { invalid: true };

    expect(() => buildReportDocument(run, GENERATED_AT)).toThrow(ReportDocumentAssemblyError);
    expect(() => buildReportDocument(run, GENERATED_AT)).toThrow("narrative output is invalid");
  });
});
