import { describe, expect, it, vi } from "vitest";

import {
  fetchReportPdfSignedUrl,
  openReportPdfSignedUrl,
  PDF_NOT_AVAILABLE_MESSAGE,
  PDF_SIGNED_URL_ERROR_MESSAGE
} from "@/app/app/reports/[runId]/ReportDownloadButton";

function buildJsonResponse(ok: boolean, payload: unknown): Pick<Response, "json" | "ok"> {
  return {
    ok,
    json: async () => payload
  };
}

describe("ReportDownloadButton helpers", () => {
  it("fetches a signed PDF URL and opens it in a new tab", async () => {
    const signedUrl = "https://storage.example.com/report.pdf?token=abc";
    const fetchPdf = vi.fn(async () => buildJsonResponse(true, { signedUrl }));
    const openWindow = vi.fn(() => ({ closed: false }) as Window);

    await expect(fetchReportPdfSignedUrl("run-1", fetchPdf)).resolves.toEqual({
      ok: true,
      signedUrl
    });

    expect(fetchPdf).toHaveBeenCalledWith("/api/v1/report-runs/run-1/pdf", {
      cache: "no-store"
    });
    expect(openReportPdfSignedUrl(signedUrl, openWindow)).toBe(true);
    expect(openWindow).toHaveBeenCalledWith(
      signedUrl,
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("maps missing artifacts to the planned friendly message", async () => {
    const fetchPdf = vi.fn(async () =>
      buildJsonResponse(false, {
        error: {
          code: "ARTIFACT_NOT_FOUND",
          message: "PDF artifact is not available."
        }
      })
    );

    await expect(fetchReportPdfSignedUrl("run-1", fetchPdf)).resolves.toEqual({
      ok: false,
      message: PDF_NOT_AVAILABLE_MESSAGE
    });
  });

  it("maps signed URL failures to a retryable friendly message", async () => {
    const fetchPdf = vi.fn(async () =>
      buildJsonResponse(false, {
        error: {
          code: "SIGNED_URL_ERROR",
          message: "Failed to generate download URL."
        }
      })
    );

    await expect(fetchReportPdfSignedUrl("run-1", fetchPdf)).resolves.toEqual({
      ok: false,
      message: PDF_SIGNED_URL_ERROR_MESSAGE
    });
  });

  it("maps malformed success responses to a retryable friendly message", async () => {
    const fetchPdf = vi.fn(async () => buildJsonResponse(true, {}));

    await expect(fetchReportPdfSignedUrl("run-1", fetchPdf)).resolves.toEqual({
      ok: false,
      message: PDF_SIGNED_URL_ERROR_MESSAGE
    });
  });
});
