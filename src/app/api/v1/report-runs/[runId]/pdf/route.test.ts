import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  ArtifactNotFoundError,
  ReportRunNotFoundError,
  SignedUrlError
} from "@/server/services/report-run-service";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const TEST_RUN_ID = "33333333-3333-4333-8333-333333333333";

const { mockGetPdfSignedUrl } = vi.hoisted(() => ({
  mockGetPdfSignedUrl: vi.fn()
}));

vi.mock("@/server/services/report-run-service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/services/report-run-service")>();
  return {
    ...original,
    ReportRunService: class {
      getPdfSignedUrl = mockGetPdfSignedUrl;
    }
  };
});

import { GET } from "@/app/api/v1/report-runs/[runId]/pdf/route";

function buildRequest(headers: Record<string, string> = {}) {
  return new Request(`http://localhost/api/v1/report-runs/${TEST_RUN_ID}/pdf`, {
    method: "GET",
    headers
  });
}

function buildParams(runId: string = TEST_RUN_ID) {
  return { params: Promise.resolve({ runId }) };
}

describe("GET /api/v1/report-runs/:runId/pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with signed URL on success", async () => {
    mockGetPdfSignedUrl.mockResolvedValue({
      signedUrl: "https://storage.example.com/signed",
      expiresInSeconds: 300
    });

    const response = await GET(buildRequest({ "x-user-id": TEST_USER_ID }), buildParams());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      signedUrl: "https://storage.example.com/signed",
      expiresInSeconds: 300
    });
  });

  it("returns 401 when X-User-Id header is missing", async () => {
    const response = await GET(buildRequest(), buildParams());

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error.code).toBe("MISSING_USER_ID");
  });

  it("returns 401 when X-User-Id is not a valid UUID", async () => {
    const response = await GET(buildRequest({ "x-user-id": "bad" }), buildParams());

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error.code).toBe("INVALID_USER_ID");
  });

  it("returns 400 when runId is not a valid UUID", async () => {
    const response = await GET(
      buildRequest({ "x-user-id": TEST_USER_ID }),
      buildParams("not-a-uuid")
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe("INVALID_RUN_ID");
  });

  it("returns 404 when report run is not found", async () => {
    mockGetPdfSignedUrl.mockRejectedValue(new ReportRunNotFoundError("Not found"));

    const response = await GET(buildRequest({ "x-user-id": TEST_USER_ID }), buildParams());

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error.code).toBe("REPORT_RUN_NOT_FOUND");
  });

  it("returns 404 when artifact is not found", async () => {
    mockGetPdfSignedUrl.mockRejectedValue(new ArtifactNotFoundError("Not completed"));

    const response = await GET(buildRequest({ "x-user-id": TEST_USER_ID }), buildParams());

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error.code).toBe("ARTIFACT_NOT_FOUND");
  });

  it("returns 502 when signed URL generation fails", async () => {
    mockGetPdfSignedUrl.mockRejectedValue(new SignedUrlError("Storage error"));

    const response = await GET(buildRequest({ "x-user-id": TEST_USER_ID }), buildParams());

    expect(response.status).toBe(502);
    const json = await response.json();
    expect(json.error.code).toBe("SIGNED_URL_ERROR");
  });
});
