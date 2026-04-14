import { describe, expect, it } from "vitest";

import { buildContractFixturePayloads } from "@/server/contracts/fixtures";
import type { ReportDocument } from "@/server/contracts";
import { REPORT_DISCLAIMER_TEXT } from "@/server/shared/constants";

import { buildReportHtml } from "./build-report-html";
import {
  buildReportDocument,
  type ReportRunForDocumentAssembly
} from "@/server/orchestrators/build-report-document";

function getFixtureReport(): ReportDocument {
  return buildContractFixturePayloads().reportDocument;
}

describe("buildReportHtml", () => {
  it("returns a complete HTML document", () => {
    const html = buildReportHtml(getFixtureReport());

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
    expect(html).toContain("<head>");
    expect(html).toContain("<body>");
  });

  it("includes inline styles", () => {
    const html = buildReportHtml(getFixtureReport());

    expect(html).toContain("<style>");
    expect(html).toContain("font-family");
    expect(html).toContain("#f96b2a");
  });

  // ------- Cover page -------

  it("renders the cover page with brand, title, and portfolio name", () => {
    const report = getFixtureReport();
    const html = buildReportHtml(report);

    expect(html).toContain("Second Act");
    expect(html).toContain("Quarterly Portfolio");
    expect(html).toContain("Grading Report");
    expect(html).toContain(report.portfolio.name);
  });

  it("renders report metadata on the cover page", () => {
    const report = getFixtureReport();
    const html = buildReportHtml(report);

    expect(html).toContain(report.metadata.runId);
    expect(html).toContain(report.metadata.reportingCurrency);
  });

  it("renders portfolio description on the cover page when present", () => {
    const report = getFixtureReport();
    const html = buildReportHtml(report);

    expect(report.portfolio.description).toBeTruthy();
    expect(html).toContain(report.portfolio.description!);
  });

  it("omits portfolio description when null", () => {
    const report = getFixtureReport();
    report.portfolio.description = null;
    const html = buildReportHtml(report);

    expect(html).not.toContain("undefined");
  });

  // ------- Executive summary -------

  it("renders the executive summary section", () => {
    const html = buildReportHtml(getFixtureReport());

    expect(html).toContain("Executive Summary");
    expect(html).toContain("Total Market Value");
    expect(html).toContain("Total Cost Basis");
    expect(html).toContain("Unrealized P&amp;L");
    expect(html).toContain("Holdings");
  });

  it("renders portfolio totals in executive summary", () => {
    const report = getFixtureReport();
    const html = buildReportHtml(report);
    const totals = report.canonicalSnapshot.portfolioTotals;

    // The formatted currency should contain the numeric portion
    expect(html).toContain(totals.holdingCount.toString());
    expect(html).toContain("Gainers / Losers");
    expect(html).toContain("Concentration (HHI)");
  });

  it("renders key findings from analysis sections", () => {
    const report = getFixtureReport();
    const html = buildReportHtml(report);

    expect(html).toContain("Key Findings");
    // Fixture sections have findings like "Finding for section-1"
    expect(html).toContain("Finding for section-1");
  });

  // ------- Analysis + Narrative sections -------

  it("renders all analysis sections", () => {
    const report = getFixtureReport();
    const html = buildReportHtml(report);

    for (const section of report.analysis.sections) {
      expect(html).toContain(section.sectionTitle);
    }
  });

  it("renders metrics within analysis sections", () => {
    const report = getFixtureReport();
    const html = buildReportHtml(report);

    // Fixture sections have metrics like "Market value" and "Holding count"
    expect(html).toContain("Market value");
    expect(html).toContain("Holding count");
  });

  it("renders analysis tables", () => {
    const report = getFixtureReport();
    const html = buildReportHtml(report);

    // Fixture sections have tables with columns for "Ticker" and "Market Value"
    expect(html).toContain("Ticker");
    // Fixture holdings AAPL should appear in table rows
    expect(html).toContain("AAPL");
    expect(html).toContain("SHOP.TO");
  });

  it("renders narrative summary and takeaways for sections", () => {
    const report = getFixtureReport();
    const html = buildReportHtml(report);

    // Fixture narratives have "Summary narrative for Section X."
    expect(html).toContain("Summary narrative for Section 1");
    expect(html).toContain("Key takeaway for section-1");
  });

  it("renders per-metric narratives", () => {
    const report = getFixtureReport();
    const html = buildReportHtml(report);

    // Fixture metric narratives contain "Narrative for Market value."
    expect(html).toContain("Narrative for Market value.");
    expect(html).toContain("Takeaway for section-1-market-value");
  });

  it("renders section findings", () => {
    const report = getFixtureReport();
    const html = buildReportHtml(report);

    expect(html).toContain("Findings");
    expect(html).toContain("Finding for section-2");
  });

  it("renders data quality flags on sections that have them", () => {
    const report = getFixtureReport();
    const html = buildReportHtml(report);

    // Fixture section at index 1 has "contains_delayed_quotes"
    expect(html).toContain("Data Quality Notes");
    expect(html).toContain("contains delayed quotes");
  });

  // ------- Methodology -------

  it("renders the methodology and assumptions section", () => {
    const report = getFixtureReport();
    const html = buildReportHtml(report);

    expect(html).toContain("Methodology");
    expect(html).toContain("Assumptions");
    expect(html).toContain(report.metadata.marketDataProvider);
    expect(html).toContain(report.metadata.narrativeProvider);
    expect(html).toContain(report.metadata.narrativeModel);
    expect(html).toContain(report.metadata.canonicalSchemaVersion);
    expect(html).toContain(report.metadata.analysisSchemaVersion);
    expect(html).toContain(report.metadata.narrativeSchemaVersion);
  });

  it("renders methodology notes", () => {
    const report = getFixtureReport();
    const html = buildReportHtml(report);

    expect(html).toContain("All monetary values are normalized into the portfolio base currency.");
  });

  // ------- Disclaimer -------

  it("renders the mandatory disclaimer section", () => {
    const html = buildReportHtml(getFixtureReport());

    expect(html).toContain("Important Disclaimer");
    expect(html).toContain("NOT INVESTMENT ADVICE");
    expect(html).toContain(REPORT_DISCLAIMER_TEXT);
  });

  it("renders the disclaimer version", () => {
    const report = getFixtureReport();
    const html = buildReportHtml(report);

    expect(html).toContain(report.compliance.disclaimerVersion);
  });

  // ------- Numbering and ordering -------

  it("numbers sections sequentially starting with 01 for executive summary", () => {
    const html = buildReportHtml(getFixtureReport());

    expect(html).toContain(">01<");
    expect(html).toContain(">02<");
    expect(html).toContain(">03<");
  });

  it("orders analysis sections by their order field", () => {
    const report = getFixtureReport();
    const html = buildReportHtml(report);

    const section1Pos = html.indexOf("Section 1");
    const section2Pos = html.indexOf("Section 2");
    const section7Pos = html.indexOf("Section 7");

    expect(section1Pos).toBeLessThan(section2Pos);
    expect(section2Pos).toBeLessThan(section7Pos);
  });

  // ------- HTML safety -------

  it("escapes HTML special characters in text content", () => {
    const report = getFixtureReport();
    report.portfolio.name = 'Test <script>alert("xss")</script>';
    const html = buildReportHtml(report);

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  // ------- Edge cases -------

  it("handles null portfolio totals gracefully", () => {
    const report = getFixtureReport();
    report.canonicalSnapshot.portfolioTotals.totalMarketValue = null;
    report.canonicalSnapshot.portfolioTotals.totalCostBasis = null;
    report.analysis.summary.totalMarketValue = null;
    report.analysis.summary.totalCostBasis = null;

    const html = buildReportHtml(report);

    expect(html).toContain("N/A");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("NaN");
  });

  it("handles sections with empty metrics", () => {
    const report = getFixtureReport();
    report.analysis.sections[0]!.metrics = [];

    const html = buildReportHtml(report);

    // Should still render the section title without error
    expect(html).toContain(report.analysis.sections[0]!.sectionTitle);
  });

  it("handles sections with empty tables", () => {
    const report = getFixtureReport();
    report.analysis.sections[0]!.tables = [];

    const html = buildReportHtml(report);

    expect(html).toContain(report.analysis.sections[0]!.sectionTitle);
  });

  it("handles missing narrative for a section gracefully", () => {
    const report = getFixtureReport();
    // Remove the narrative section for section-1
    report.narrative.sections = report.narrative.sections.filter(
      (s) => s.sectionKey !== "section-1"
    );

    const html = buildReportHtml(report);

    // The analysis section should still render
    expect(html).toContain("Section 1");
    // But the narrative block for it should not appear
    expect(html).not.toContain("Summary narrative for Section 1");
  });

  it("handles null promptVersion in metadata", () => {
    const report = getFixtureReport();
    report.metadata.promptVersion = null;

    const html = buildReportHtml(report);

    expect(html).toContain("N/A");
  });

  it("labels currency as the run reportingCurrency, not portfolio baseCurrency (end-to-end)", () => {
    const { canonicalSnapshot, analysisOutput, narrativeOutput } = buildContractFixturePayloads();

    // baseCurrency is USD, but the run requests CAD
    const run: ReportRunForDocumentAssembly = {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      userId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      portfolioId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      reportingCurrency: "CAD",
      requestedAt: new Date("2026-04-11T11:55:00.000Z"),
      marketDataProvider: "yfinance",
      narrativeProvider: "openai-compatible",
      narrativeModel: "local-mistral",
      promptVersion: "narrative-explainer.v1",
      valuationAsOf: new Date("2026-04-10T20:00:00.000Z"),
      canonicalSnapshot: JSON.parse(JSON.stringify(canonicalSnapshot)),
      analysisOutput: JSON.parse(JSON.stringify(analysisOutput)),
      narrativeOutput: JSON.parse(JSON.stringify(narrativeOutput)),
      portfolio: {
        name: "Multi-Currency Portfolio",
        description: "Portfolio with USD base but CAD reporting.",
        baseCurrency: "USD"
      }
    };

    // Assemble the report document (uses run.reportingCurrency for portfolio context)
    const doc = buildReportDocument(run, new Date("2026-04-11T12:00:00.000Z"));

    // Render to HTML
    const html = buildReportHtml(doc);

    // Cover page and appendix should show CAD as the reporting currency
    expect(html).toContain("CAD");
    // Executive summary currency values should be prefixed with CAD, not USD
    expect(html).toContain("CAD ");
    // The HTML should NOT use USD for formatted currency values
    expect(html).not.toMatch(/USD \d/);
  });
});
