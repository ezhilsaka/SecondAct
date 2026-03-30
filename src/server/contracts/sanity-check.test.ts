import { describe, expect, it } from "vitest";

import { buildContractFixturePayloads } from "@/server/contracts/fixtures";
import { marketSecuritySnapshotSchema } from "@/server/contracts/market-data";
import { renderPdfResultSchema, reportDocumentSchema } from "@/server/contracts/report";
import { runContractSanityCheck } from "@/server/contracts/sanity-check";

describe("runContractSanityCheck", () => {
  it("validates the current contract fixtures end to end", () => {
    expect(runContractSanityCheck()).toEqual({
      ok: true,
      tickersValidated: 2,
      analysisSectionsValidated: 7,
      narrativeSectionsValidated: 7,
      reportSchemaVersion: "report.v1"
    });
  });
});

describe("contract schemas", () => {
  it("defaults missing market security data quality flags to an empty array", () => {
    const parsedSnapshot = marketSecuritySnapshotSchema.parse({
      ticker: "AAPL",
      securityName: "Apple Inc.",
      assetClass: "EQUITY",
      securityCurrency: "USD",
      reportingCurrency: "USD",
      currentPrice: "214.12000000",
      fxRateToReportingCurrency: "1",
      quoteTimestamp: "2026-03-28T20:00:00.000Z"
    });

    expect(parsedSnapshot.dataQualityFlags).toEqual([]);
  });

  it("rejects report documents with tampered compliance text", () => {
    const { reportDocument } = buildContractFixturePayloads();
    const invalidReportDocument = structuredClone(reportDocument) as unknown as {
      compliance: {
        disclaimerText: string;
      };
    };

    invalidReportDocument.compliance.disclaimerText = "Tampered disclaimer.";

    expect(() => reportDocumentSchema.parse(invalidReportDocument)).toThrow();
  });

  it("rejects invalid PDF checksum values", () => {
    const { renderPdfResult } = buildContractFixturePayloads();
    const invalidRenderResult = {
      ...renderPdfResult,
      checksumSha256: "not-a-valid-checksum"
    };

    expect(() => renderPdfResultSchema.parse(invalidRenderResult)).toThrow(/SHA-256/);
  });

  it("rejects PDF paths that contain traversal segments", () => {
    const { renderPdfResult } = buildContractFixturePayloads();
    const invalidRenderResult = {
      ...renderPdfResult,
      filePath: "/tmp/secondact/../../etc/passwd"
    };

    expect(() => renderPdfResultSchema.parse(invalidRenderResult)).toThrow(
      /filePath must be an absolute path with no traversal components/
    );
  });
});
