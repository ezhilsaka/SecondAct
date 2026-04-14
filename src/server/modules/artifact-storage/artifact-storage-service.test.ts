import { vol } from "memfs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildContractFixturePayloads } from "@/server/contracts/fixtures";

import {
  ArtifactStorageService,
  ArtifactAlreadyExistsError,
  ArtifactMetadataError,
  ArtifactUploadError,
  type ArtifactStorageRepository,
  type StorageUploader
} from "./artifact-storage-service";

vi.mock("node:fs/promises", async () => {
  const memfs = await vi.importActual<typeof import("memfs")>("memfs");
  return {
    readFile: memfs.fs.promises.readFile,
    rm: memfs.fs.promises.rm
  };
});

const FAKE_PDF_BYTES = Buffer.from("%PDF-1.4 fake-content");

const RUN_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const BUCKET = "report-pdfs";

function buildMockRepository(): ArtifactStorageRepository {
  return {
    createArtifactRecord: vi.fn().mockResolvedValue({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })
  };
}

function buildMockUploader(): StorageUploader {
  return {
    upload: vi.fn().mockResolvedValue(undefined)
  };
}

function seedLocalFile(filePath: string) {
  const dir = filePath.substring(0, filePath.lastIndexOf("/"));
  vol.mkdirSync(dir, { recursive: true });
  vol.writeFileSync(filePath, FAKE_PDF_BYTES);
}

afterEach(() => {
  vol.reset();
});

describe("ArtifactStorageService", () => {
  it("uploads the PDF, creates the artifact record, and cleans up the temp directory", async () => {
    const { renderPdfResult } = buildContractFixturePayloads();
    seedLocalFile(renderPdfResult.filePath);

    const repository = buildMockRepository();
    const storageUploader = buildMockUploader();
    const service = new ArtifactStorageService({
      repository,
      storageUploader,
      bucket: BUCKET
    });

    const result = await service.storeForReportRun({
      reportRunId: RUN_ID,
      userId: USER_ID,
      renderResult: renderPdfResult
    });

    // Verify the storage upload was called with correct args
    expect(storageUploader.upload).toHaveBeenCalledWith(
      BUCKET,
      `${USER_ID}/${RUN_ID}/report.pdf`,
      expect.any(Buffer)
    );

    // Verify the uploaded buffer contains the fake PDF content
    const uploadedBuffer = (storageUploader.upload as ReturnType<typeof vi.fn>).mock.calls[0][2];
    expect(uploadedBuffer).toEqual(FAKE_PDF_BYTES);

    // Verify the artifact record was created with correct metadata
    expect(repository.createArtifactRecord).toHaveBeenCalledWith({
      userId: USER_ID,
      reportRunId: RUN_ID,
      artifactType: "PDF_REPORT",
      storageBucket: BUCKET,
      storagePath: `${USER_ID}/${RUN_ID}/report.pdf`,
      mimeType: "application/pdf",
      fileSizeBytes: BigInt(renderPdfResult.byteSize!),
      checksumSha256: renderPdfResult.checksumSha256!
    });

    // Verify the result
    expect(result.artifactId).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(result.storageBucket).toBe(BUCKET);
    expect(result.storagePath).toBe(`${USER_ID}/${RUN_ID}/report.pdf`);

    // Verify local temp directory was cleaned up
    expect(vol.existsSync(renderPdfResult.filePath)).toBe(false);
  });

  it("falls back to buffer.byteLength when renderResult.byteSize is undefined", async () => {
    const { renderPdfResult } = buildContractFixturePayloads();
    seedLocalFile(renderPdfResult.filePath);

    const renderResultNoByte = { ...renderPdfResult, byteSize: undefined };

    const repository = buildMockRepository();
    const storageUploader = buildMockUploader();
    const service = new ArtifactStorageService({
      repository,
      storageUploader,
      bucket: BUCKET
    });

    await service.storeForReportRun({
      reportRunId: RUN_ID,
      userId: USER_ID,
      renderResult: renderResultNoByte
    });

    expect(repository.createArtifactRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        fileSizeBytes: BigInt(FAKE_PDF_BYTES.byteLength)
      })
    );
  });

  it("passes null checksumSha256 when renderResult does not include it", async () => {
    const { renderPdfResult } = buildContractFixturePayloads();
    seedLocalFile(renderPdfResult.filePath);

    const renderResultNoChecksum = { ...renderPdfResult, checksumSha256: undefined };

    const repository = buildMockRepository();
    const storageUploader = buildMockUploader();
    const service = new ArtifactStorageService({
      repository,
      storageUploader,
      bucket: BUCKET
    });

    await service.storeForReportRun({
      reportRunId: RUN_ID,
      userId: USER_ID,
      renderResult: renderResultNoChecksum
    });

    expect(repository.createArtifactRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        checksumSha256: null
      })
    );
  });

  it("throws ArtifactUploadError when the upload fails", async () => {
    const { renderPdfResult } = buildContractFixturePayloads();
    seedLocalFile(renderPdfResult.filePath);

    const repository = buildMockRepository();
    const storageUploader: StorageUploader = {
      upload: vi.fn().mockRejectedValue(new ArtifactUploadError("upload failed"))
    };
    const service = new ArtifactStorageService({
      repository,
      storageUploader,
      bucket: BUCKET
    });

    await expect(
      service.storeForReportRun({
        reportRunId: RUN_ID,
        userId: USER_ID,
        renderResult: renderPdfResult
      })
    ).rejects.toBeInstanceOf(ArtifactUploadError);

    // Should not create artifact record when upload fails
    expect(repository.createArtifactRecord).not.toHaveBeenCalled();
  });

  it("rejects an invalid reportRunId", async () => {
    const { renderPdfResult } = buildContractFixturePayloads();
    seedLocalFile(renderPdfResult.filePath);

    const repository = buildMockRepository();
    const storageUploader = buildMockUploader();
    const service = new ArtifactStorageService({
      repository,
      storageUploader,
      bucket: BUCKET
    });

    await expect(
      service.storeForReportRun({
        reportRunId: "../../etc/passwd",
        userId: USER_ID,
        renderResult: renderPdfResult
      })
    ).rejects.toThrow();

    expect(storageUploader.upload).not.toHaveBeenCalled();
    expect(repository.createArtifactRecord).not.toHaveBeenCalled();
  });

  it("rejects an invalid userId", async () => {
    const { renderPdfResult } = buildContractFixturePayloads();
    seedLocalFile(renderPdfResult.filePath);

    const repository = buildMockRepository();
    const storageUploader = buildMockUploader();
    const service = new ArtifactStorageService({
      repository,
      storageUploader,
      bucket: BUCKET
    });

    await expect(
      service.storeForReportRun({
        reportRunId: RUN_ID,
        userId: "not-a-uuid",
        renderResult: renderPdfResult
      })
    ).rejects.toThrow();

    expect(storageUploader.upload).not.toHaveBeenCalled();
    expect(repository.createArtifactRecord).not.toHaveBeenCalled();
  });

  it("stores fileSizeBytes as BigInt", async () => {
    const { renderPdfResult } = buildContractFixturePayloads();
    seedLocalFile(renderPdfResult.filePath);

    const repository = buildMockRepository();
    const storageUploader = buildMockUploader();
    const service = new ArtifactStorageService({
      repository,
      storageUploader,
      bucket: BUCKET
    });

    await service.storeForReportRun({
      reportRunId: RUN_ID,
      userId: USER_ID,
      renderResult: renderPdfResult
    });

    const createCall = (repository.createArtifactRecord as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(typeof createCall.fileSizeBytes).toBe("bigint");
  });

  it("allows retry after metadata write failure by tolerating duplicate upload", async () => {
    const { renderPdfResult } = buildContractFixturePayloads();

    // First call: upload succeeds, metadata write fails (orphaned blob)
    // Second call: upload throws ArtifactAlreadyExistsError (blob exists), service continues to metadata
    const storageUploader: StorageUploader = {
      upload: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new ArtifactAlreadyExistsError("already exists"))
    };
    const repository: ArtifactStorageRepository = {
      createArtifactRecord: vi
        .fn()
        .mockRejectedValueOnce(new ArtifactMetadataError("DB connection lost"))
        .mockResolvedValueOnce({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })
    };

    const service = new ArtifactStorageService({
      repository,
      storageUploader,
      bucket: BUCKET
    });

    // First attempt: upload succeeds, metadata write fails
    seedLocalFile(renderPdfResult.filePath);
    await expect(
      service.storeForReportRun({
        reportRunId: RUN_ID,
        userId: USER_ID,
        renderResult: renderPdfResult
      })
    ).rejects.toBeInstanceOf(ArtifactMetadataError);
    expect(storageUploader.upload).toHaveBeenCalledTimes(1);

    // Retry: upload throws ArtifactAlreadyExistsError (orphaned blob), service tolerates it and writes metadata
    seedLocalFile(renderPdfResult.filePath);
    const result = await service.storeForReportRun({
      reportRunId: RUN_ID,
      userId: USER_ID,
      renderResult: renderPdfResult
    });
    expect(storageUploader.upload).toHaveBeenCalledTimes(2);
    expect(result.artifactId).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });

  it("propagates non-duplicate upload errors without catching them", async () => {
    const { renderPdfResult } = buildContractFixturePayloads();
    seedLocalFile(renderPdfResult.filePath);

    const repository = buildMockRepository();
    const storageUploader: StorageUploader = {
      upload: vi.fn().mockRejectedValue(new ArtifactUploadError("network timeout"))
    };
    const service = new ArtifactStorageService({
      repository,
      storageUploader,
      bucket: BUCKET
    });

    await expect(
      service.storeForReportRun({
        reportRunId: RUN_ID,
        userId: USER_ID,
        renderResult: renderPdfResult
      })
    ).rejects.toBeInstanceOf(ArtifactUploadError);
    await expect(
      service.storeForReportRun({
        reportRunId: RUN_ID,
        userId: USER_ID,
        renderResult: renderPdfResult
      })
    ).rejects.not.toBeInstanceOf(ArtifactAlreadyExistsError);

    expect(repository.createArtifactRecord).not.toHaveBeenCalled();
  });
});
