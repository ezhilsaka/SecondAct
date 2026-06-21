import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  GENERIC_REPORT_FAILURE_MESSAGE,
  getLongRunningReportMessage,
  getReportFailureMessage,
  getReportStatusCopy,
  refreshReportStatusOnce,
  REPORT_STATUS_REFRESH_ERROR_MESSAGE,
  ReportStatusPanel,
  shouldPollReportStatus
} from "@/app/app/reports/[runId]/ReportStatusPanel";
import type { ReportRunStatusResult } from "@/server/services/report-run-service";

const TEST_RUN_ID = "33333333-3333-4333-8333-333333333333";
const TEST_PORTFOLIO_ID = "22222222-2222-4222-8222-222222222222";

function buildStatus(overrides: Partial<ReportRunStatusResult> = {}): ReportRunStatusResult {
  return {
    runId: TEST_RUN_ID,
    portfolioId: TEST_PORTFOLIO_ID,
    portfolioName: "Retirement Portfolio",
    status: "QUEUED",
    paymentStatus: "NOT_REQUIRED",
    reportingCurrency: "CAD",
    errorCode: null,
    requestedAt: "2026-06-20T12:00:00.000Z",
    startedAt: null,
    completedAt: null,
    failedAt: null,
    ...overrides
  };
}

describe("ReportStatusPanel", () => {
  it("renders queued report status with active polling copy", () => {
    const html = renderToStaticMarkup(<ReportStatusPanel initialStatus={buildStatus()} />);

    expect(html).toContain("Your report is in line to be generated.");
    expect(html).toContain("Checking for updates...");
    expect(html).toContain("Retirement Portfolio");
    expect(html).toContain("CAD");
    expect(html).not.toContain("Open PDF");
  });

  it("renders processing report status with active polling copy", () => {
    const html = renderToStaticMarkup(
      <ReportStatusPanel
        initialStatus={buildStatus({
          status: "PROCESSING",
          startedAt: "2026-06-20T12:01:00.000Z"
        })}
      />
    );

    expect(html).toContain("We are building your report now.");
    expect(html).toContain("Checking for updates...");
  });

  it("renders completed report status without polling copy", () => {
    const html = renderToStaticMarkup(
      <ReportStatusPanel
        initialStatus={buildStatus({
          status: "COMPLETED",
          startedAt: "2026-06-20T12:01:00.000Z",
          completedAt: "2026-06-20T12:03:00.000Z"
        })}
      />
    );

    expect(html).toContain("Your report is ready.");
    expect(html).toContain("Open PDF");
    expect(html).not.toContain("Checking for updates...");
  });

  it("renders failed report status without polling copy", () => {
    const html = renderToStaticMarkup(
      <ReportStatusPanel
        initialStatus={buildStatus({
          status: "FAILED",
          startedAt: "2026-06-20T12:01:00.000Z",
          failedAt: "2026-06-20T12:02:00.000Z",
          errorCode: "CANONICAL_FAILURE"
        })}
      />
    );

    expect(html).toContain("We could not finish this report.");
    expect(html).toContain("We could not prepare the market-data snapshot for this report.");
    expect(html).toContain("Retry report");
    expect(html).toContain('name="retrySourceRunId"');
    expect(html).not.toContain("Checking for updates...");
  });

  it("maps known and unknown failure codes to friendly copy", () => {
    expect(getReportFailureMessage("CANONICAL_FAILURE")).toContain("market-data snapshot");
    expect(getReportFailureMessage("MARKET_DATA_OR_CANONICAL_FAILURE")).toContain(
      "market-data snapshot"
    );
    expect(getReportFailureMessage("ANALYSIS_FAILURE")).toContain("portfolio calculations");
    expect(getReportFailureMessage("NARRATIVE_FAILURE")).toContain("plain-English explanation");
    expect(getReportFailureMessage("RENDER_FAILURE")).toContain("prepare the PDF");
    expect(getReportFailureMessage("PDF_FAILURE")).toContain("prepare the PDF");
    expect(getReportFailureMessage("STORAGE_FAILURE")).toContain("save it for download");
    expect(getReportFailureMessage("ORCHESTRATION_FAILURE")).toBe(GENERIC_REPORT_FAILURE_MESSAGE);
    expect(getReportFailureMessage("UNKNOWN_FAILURE")).toBe(GENERIC_REPORT_FAILURE_MESSAGE);
    expect(getReportFailureMessage(null)).toBe(GENERIC_REPORT_FAILURE_MESSAGE);
  });

  it("renders long-running queued copy after the threshold", () => {
    const status = buildStatus({
      status: "QUEUED",
      requestedAt: "2026-06-20T12:00:00.000Z"
    });
    const html = renderToStaticMarkup(
      <ReportStatusPanel
        initialStatus={status}
        nowMs={Date.parse("2026-06-20T12:10:00.000Z")}
        pollIntervalMs={3000}
        fetchStatus={async () => status}
      />
    );

    expect(
      getLongRunningReportMessage(status, Date.parse("2026-06-20T12:10:00.000Z"))
    ).toContain("background process is running");
    expect(html).toContain("background process is running");
    expect(html).toContain("Checking for updates...");
  });

  it("renders long-running processing copy after the threshold", () => {
    const status = buildStatus({
      status: "PROCESSING",
      requestedAt: "2026-06-20T12:00:00.000Z",
      startedAt: "2026-06-20T12:01:00.000Z"
    });
    const html = renderToStaticMarkup(
      <ReportStatusPanel
        initialStatus={status}
        nowMs={Date.parse("2026-06-20T12:11:00.000Z")}
        pollIntervalMs={3000}
        fetchStatus={async () => status}
      />
    );

    expect(
      getLongRunningReportMessage(status, Date.parse("2026-06-20T12:11:00.000Z"))
    ).toContain("taking longer than usual");
    expect(html).toContain("taking longer than usual");
  });

  it("continues polling only while a report is queued or processing", () => {
    expect(shouldPollReportStatus("QUEUED")).toBe(true);
    expect(shouldPollReportStatus("PROCESSING")).toBe(true);
    expect(shouldPollReportStatus("COMPLETED")).toBe(false);
    expect(shouldPollReportStatus("FAILED")).toBe(false);
  });

  it("falls back safely for unexpected status values", () => {
    expect(getReportStatusCopy("UNKNOWN").title).toBe("Report status is unavailable.");
  });

  it("returns refreshed status and clears the transient polling message", async () => {
    const completedStatus = buildStatus({
      status: "COMPLETED",
      completedAt: "2026-06-20T12:03:00.000Z"
    });

    await expect(
      refreshReportStatusOnce(TEST_RUN_ID, async () => completedStatus)
    ).resolves.toEqual({
      status: completedStatus,
      refreshMessage: null
    });
  });

  it("converts transient polling failures into a retry message", async () => {
    await expect(
      refreshReportStatusOnce(TEST_RUN_ID, async () => {
        throw new Error("network failed");
      })
    ).resolves.toEqual({
      status: null,
      refreshMessage: REPORT_STATUS_REFRESH_ERROR_MESSAGE
    });
  });
});
