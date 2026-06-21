"use client";

import { useState } from "react";

import styles from "./page.module.css";

type PdfSignedUrlSuccess = {
  ok: true;
  signedUrl: string;
};

type PdfSignedUrlFailure = {
  ok: false;
  message: string;
};

type PdfSignedUrlResult = PdfSignedUrlSuccess | PdfSignedUrlFailure;

type PdfFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Pick<Response, "json" | "ok">>;

type WindowOpen = (
  url: string,
  target: string,
  features: string
) => Window | null;

export const PDF_NOT_AVAILABLE_MESSAGE =
  "The PDF is not available yet. Try refreshing in a moment.";
export const PDF_SIGNED_URL_ERROR_MESSAGE = "We could not open the PDF. Please try again.";
export const PDF_POPUP_BLOCKED_MESSAGE =
  "The PDF is ready, but the browser blocked the new tab. Allow pop-ups and try again.";

function readErrorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") {
    return null;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

export async function fetchReportPdfSignedUrl(
  runId: string,
  fetchPdf: PdfFetch = fetch
): Promise<PdfSignedUrlResult> {
  try {
    const response = await fetchPdf(`/api/v1/report-runs/${runId}/pdf`, {
      cache: "no-store"
    });
    const payload = (await response.json()) as unknown;

    if (response.ok) {
      const signedUrl = (payload as { signedUrl?: unknown }).signedUrl;
      if (typeof signedUrl === "string" && signedUrl.length > 0) {
        return { ok: true, signedUrl };
      }

      return { ok: false, message: PDF_SIGNED_URL_ERROR_MESSAGE };
    }

    if (readErrorCode(payload) === "ARTIFACT_NOT_FOUND") {
      return { ok: false, message: PDF_NOT_AVAILABLE_MESSAGE };
    }

    return { ok: false, message: PDF_SIGNED_URL_ERROR_MESSAGE };
  } catch {
    return { ok: false, message: PDF_SIGNED_URL_ERROR_MESSAGE };
  }
}

export function openReportPdfSignedUrl(
  signedUrl: string,
  openWindow: WindowOpen = (url, target, features) => window.open(url, target, features)
): boolean {
  return Boolean(openWindow(signedUrl, "_blank", "noopener,noreferrer"));
}

export function ReportDownloadButton({ runId }: { runId: string }) {
  const [isOpening, setIsOpening] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleOpenPdf() {
    setIsOpening(true);
    setMessage(null);

    const result = await fetchReportPdfSignedUrl(runId);

    if (result.ok) {
      const opened = openReportPdfSignedUrl(result.signedUrl);
      setMessage(opened ? null : PDF_POPUP_BLOCKED_MESSAGE);
      setIsOpening(false);
      return;
    }

    setMessage(result.message);
    setIsOpening(false);
  }

  return (
    <div className={styles.downloadAction}>
      <button type="button" onClick={handleOpenPdf} disabled={isOpening}>
        {isOpening ? "Opening PDF..." : "Open PDF"}
      </button>
      {message ? (
        <p className={styles.inlineError} role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
