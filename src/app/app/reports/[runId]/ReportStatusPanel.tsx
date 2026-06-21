"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import type { ReportRunStatusResult } from "@/server/services/report-run-service";

import { generateReportFromPortfolio } from "../actions";
import { ReportDownloadButton } from "./ReportDownloadButton";
import styles from "./page.module.css";

type ReportStatusPanelProps = {
  initialStatus: ReportRunStatusResult;
  pollIntervalMs?: number;
  fetchStatus?: ReportStatusFetch;
  nowMs?: number;
};

type ReportStatusFetch = (runId: string) => Promise<ReportRunStatusResult>;
type StatusTone = "waiting" | "working" | "success" | "failed" | "neutral";

const LONG_RUNNING_THRESHOLD_MS = 10 * 60 * 1000;

export const REPORT_STATUS_REFRESH_ERROR_MESSAGE =
  "We could not refresh the status. We will try again shortly.";
export const GENERIC_REPORT_FAILURE_MESSAGE =
  "Something went wrong while generating this report. Please try again.";

const REPORT_FAILURE_COPY: Record<string, string> = {
  CANONICAL_FAILURE:
    "We could not prepare the market-data snapshot for this report. Check that the holdings use supported tickers and try again.",
  MARKET_DATA_OR_CANONICAL_FAILURE:
    "We could not prepare the market-data snapshot for this report. Check that the holdings use supported tickers and try again.",
  ANALYSIS_FAILURE:
    "We could not complete the portfolio calculations for this report. Please try again.",
  NARRATIVE_FAILURE:
    "We could not create the plain-English explanation for this report. Please try again.",
  RENDER_FAILURE: "We completed the analysis, but could not prepare the PDF. Please try again.",
  PDF_FAILURE: "We completed the analysis, but could not prepare the PDF. Please try again.",
  STORAGE_FAILURE: "We created the PDF, but could not save it for download. Please try again.",
  ORCHESTRATION_FAILURE: GENERIC_REPORT_FAILURE_MESSAGE
};

const STATUS_COPY: Record<string, { title: string; body: string; tone: StatusTone }> = {
  DRAFT: {
    title: "Report setup is in progress.",
    body: "Your report is being prepared.",
    tone: "neutral"
  },
  AWAITING_PAYMENT: {
    title: "Report setup is paused.",
    body: "This report is waiting for the next step.",
    tone: "neutral"
  },
  QUEUED: {
    title: "Your report is in line to be generated.",
    body: "We will keep checking for updates.",
    tone: "waiting"
  },
  PROCESSING: {
    title: "We are building your report now.",
    body: "This can take a little time while the analysis and document are prepared.",
    tone: "working"
  },
  COMPLETED: {
    title: "Your report is ready.",
    body: "The report run has completed.",
    tone: "success"
  },
  FAILED: {
    title: "We could not finish this report.",
    body: "Review the reason below and retry when ready.",
    tone: "failed"
  }
};

export function shouldPollReportStatus(status: string): boolean {
  return status === "QUEUED" || status === "PROCESSING";
}

export function getReportStatusCopy(status: string) {
  return (
    STATUS_COPY[status] ?? {
      title: "Report status is unavailable.",
      body: "Refresh the page to check this report again.",
      tone: "neutral" as StatusTone
    }
  );
}

export function getReportFailureMessage(errorCode: string | null): string {
  if (!errorCode) {
    return GENERIC_REPORT_FAILURE_MESSAGE;
  }

  return REPORT_FAILURE_COPY[errorCode] ?? GENERIC_REPORT_FAILURE_MESSAGE;
}

export function getLongRunningReportMessage(
  status: ReportRunStatusResult,
  nowMs: number = Date.now()
): string | null {
  if (status.status === "QUEUED") {
    const requestedAtMs = Date.parse(status.requestedAt);
    if (!Number.isNaN(requestedAtMs) && nowMs - requestedAtMs >= LONG_RUNNING_THRESHOLD_MS) {
      return "This is taking longer than usual, but it is safe to leave this page and come back. In local development, queued reports wait here until the background process is running.";
    }
  }

  if (status.status === "PROCESSING") {
    const startedAtMs = status.startedAt ? Date.parse(status.startedAt) : Date.parse(status.requestedAt);
    if (!Number.isNaN(startedAtMs) && nowMs - startedAtMs >= LONG_RUNNING_THRESHOLD_MS) {
      return "This report is taking longer than usual. You can leave this page and return from Reports while the document finishes.";
    }
  }

  return null;
}

async function defaultFetchReportStatus(runId: string): Promise<ReportRunStatusResult> {
  const response = await fetch(`/api/v1/report-runs/${runId}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Report status refresh failed.");
  }

  return response.json() as Promise<ReportRunStatusResult>;
}

export async function refreshReportStatusOnce(
  runId: string,
  fetchStatus: ReportStatusFetch
): Promise<{ status: ReportRunStatusResult | null; refreshMessage: string | null }> {
  try {
    return {
      status: await fetchStatus(runId),
      refreshMessage: null
    };
  } catch {
    return {
      status: null,
      refreshMessage: REPORT_STATUS_REFRESH_ERROR_MESSAGE
    };
  }
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function RetryReportSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? "Starting retry..." : "Retry report"}
    </button>
  );
}

export function ReportStatusPanel({
  initialStatus,
  pollIntervalMs = 3000,
  fetchStatus = defaultFetchReportStatus,
  nowMs
}: ReportStatusPanelProps) {
  const [status, setStatus] = useState(initialStatus);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const copy = getReportStatusCopy(status.status);
  const isPolling = shouldPollReportStatus(status.status);
  const failureMessage =
    status.status === "FAILED" ? getReportFailureMessage(status.errorCode) : null;
  const longRunningMessage = getLongRunningReportMessage(status, nowMs);

  useEffect(() => {
    if (!isPolling) {
      return;
    }

    let cancelled = false;
    const intervalId = window.setInterval(async () => {
      const result = await refreshReportStatusOnce(status.runId, fetchStatus);

      if (cancelled) {
        return;
      }

      if (result.status) {
        setStatus(result.status);
      }
      setRefreshMessage(result.refreshMessage);
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [fetchStatus, isPolling, pollIntervalMs, status.runId]);

  return (
    <section className={styles.statusPanel} aria-labelledby="report-status-heading">
      <div className={styles.statusHeader}>
        <p className={styles.cardLabel}>Report status</p>
        <span className={styles[`${copy.tone}Badge`]}>{status.status.replace("_", " ")}</span>
      </div>

      <div className={styles.statusCopy} aria-live="polite">
        <h2 id="report-status-heading">{copy.title}</h2>
        <p>{copy.body}</p>
        {failureMessage ? <p className={styles.failureReason}>{failureMessage}</p> : null}
        {longRunningMessage ? <p className={styles.longRunningNote}>{longRunningMessage}</p> : null}
        {isPolling ? <p>Checking for updates...</p> : null}
        {refreshMessage ? (
          <p className={styles.inlineError} role="status">
            {refreshMessage}
          </p>
        ) : null}
      </div>

      <dl className={styles.statusFacts}>
        <div>
          <dt>Portfolio</dt>
          <dd>{status.portfolioName}</dd>
        </div>
        <div>
          <dt>Currency</dt>
          <dd>{status.reportingCurrency}</dd>
        </div>
        <div>
          <dt>Requested</dt>
          <dd>{formatTimestamp(status.requestedAt)}</dd>
        </div>
        <div>
          <dt>Started</dt>
          <dd>{formatTimestamp(status.startedAt)}</dd>
        </div>
        <div>
          <dt>Completed</dt>
          <dd>{formatTimestamp(status.completedAt)}</dd>
        </div>
        <div>
          <dt>Failed</dt>
          <dd>{formatTimestamp(status.failedAt)}</dd>
        </div>
      </dl>

      {status.status === "COMPLETED" ? <ReportDownloadButton runId={status.runId} /> : null}

      {status.status === "FAILED" ? (
        <form action={generateReportFromPortfolio} className={styles.retryAction}>
          <input type="hidden" name="portfolioId" value={status.portfolioId} />
          <input type="hidden" name="reportingCurrency" value={status.reportingCurrency} />
          <input type="hidden" name="retrySourceRunId" value={status.runId} />
          <RetryReportSubmitButton />
        </form>
      ) : null}
    </section>
  );
}
