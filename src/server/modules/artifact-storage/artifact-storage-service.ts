import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import type { PrismaClient } from "@prisma/client";
import type { SupabaseClient } from "@supabase/supabase-js";

import { prisma } from "@/db/prisma/client";
import type { RenderPdfResult } from "@/server/contracts";
import { serverEnv } from "@/server/config";
import { supabaseAdmin } from "@/server/providers/supabase-storage-client";
import { uuidSchema } from "@/server/shared/types";

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class ArtifactUploadError extends Error {
  override name = "ArtifactUploadError";
}

export class ArtifactAlreadyExistsError extends ArtifactUploadError {
  override name = "ArtifactAlreadyExistsError";
}

export class ArtifactMetadataError extends Error {
  override name = "ArtifactMetadataError";
}

// ---------------------------------------------------------------------------
// Repository interface + Prisma implementation
// ---------------------------------------------------------------------------

export type CreateArtifactRecordInput = {
  userId: string;
  reportRunId: string;
  artifactType: "PDF_REPORT";
  storageBucket: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: bigint;
  checksumSha256: string | null;
};

export interface ArtifactStorageRepository {
  createArtifactRecord(input: CreateArtifactRecordInput): Promise<{ id: string }>;
}

export class PrismaArtifactStorageRepository implements ArtifactStorageRepository {
  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  async createArtifactRecord(input: CreateArtifactRecordInput) {
    const artifact = await this.prismaClient.reportArtifact.create({
      data: {
        userId: input.userId,
        reportRunId: input.reportRunId,
        artifactType: input.artifactType,
        storageBucket: input.storageBucket,
        storagePath: input.storagePath,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes,
        checksumSha256: input.checksumSha256
      },
      select: { id: true }
    });
    return artifact;
  }
}

// ---------------------------------------------------------------------------
// Storage client interface (thin wrapper for Supabase Storage)
// ---------------------------------------------------------------------------

export interface StorageUploader {
  upload(bucket: string, storagePath: string, fileBuffer: Buffer): Promise<void>;
}

export class SupabaseStorageUploader implements StorageUploader {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}

  async upload(bucket: string, storagePath: string, fileBuffer: Buffer) {
    const { error } = await this.client.storage.from(bucket).upload(storagePath, fileBuffer, {
      contentType: "application/pdf",
      upsert: false
    });

    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      // Soft coupling to Supabase error wording. If the message format changes,
      // duplicates will surface as a generic ArtifactUploadError (an observable
      // failed run), not silent data corruption. Revisit if Supabase JS client
      // changes its error messages.
      if (msg.includes("already exists") || msg.includes("duplicate")) {
        throw new ArtifactAlreadyExistsError(
          `Artifact already exists at ${bucket}/${storagePath}: ${error.message}`
        );
      }
      throw new ArtifactUploadError(
        `Failed to upload artifact to ${bucket}/${storagePath}: ${error.message}`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export type StoreArtifactInput = {
  reportRunId: string;
  userId: string;
  renderResult: RenderPdfResult;
};

export type StoreArtifactResult = {
  artifactId: string;
  storageBucket: string;
  storagePath: string;
};

export type ArtifactStorageServiceDependencies = {
  repository?: ArtifactStorageRepository;
  storageUploader?: StorageUploader;
  bucket?: string;
};

export class ArtifactStorageService {
  private readonly repository: ArtifactStorageRepository;
  private readonly storageUploader: StorageUploader;
  private readonly bucket: string;

  constructor(dependencies: ArtifactStorageServiceDependencies = {}) {
    this.repository = dependencies.repository ?? new PrismaArtifactStorageRepository();
    this.storageUploader = dependencies.storageUploader ?? new SupabaseStorageUploader();
    this.bucket = dependencies.bucket ?? serverEnv.SUPABASE_REPORTS_BUCKET;
  }

  async storeForReportRun(input: StoreArtifactInput): Promise<StoreArtifactResult> {
    const userId = uuidSchema.parse(input.userId);
    const reportRunId = uuidSchema.parse(input.reportRunId);

    // 1. Read the local PDF file produced by the renderer
    const fileBuffer = await readFile(input.renderResult.filePath);

    // 2. Build the storage path: {userId}/{reportRunId}/report.pdf
    const storagePath = `${userId}/${reportRunId}/report.pdf`;

    // 3. Upload to Supabase Storage (upsert: false rejects duplicates)
    //    If an orphaned blob exists from a prior attempt where metadata write
    //    failed, the upload throws ArtifactAlreadyExistsError. We treat that
    //    as safe to proceed since the path is deterministic and content identical.
    try {
      await this.storageUploader.upload(this.bucket, storagePath, fileBuffer);
    } catch (uploadError) {
      if (!(uploadError instanceof ArtifactAlreadyExistsError)) {
        throw uploadError;
      }
      // Orphaned blob from a previous attempt — safe to continue to metadata write
    }

    // 4. Resolve file size: prefer the renderer-provided value, fall back to buffer length
    const fileSizeBytes = BigInt(input.renderResult.byteSize ?? fileBuffer.byteLength);

    // 5. Create the artifact metadata row
    const artifact = await this.repository.createArtifactRecord({
      userId,
      reportRunId,
      artifactType: "PDF_REPORT",
      storageBucket: this.bucket,
      storagePath,
      mimeType: input.renderResult.mimeType,
      fileSizeBytes,
      checksumSha256: input.renderResult.checksumSha256 ?? null
    });

    // 6. Clean up the local temp directory
    const tempDir = path.dirname(input.renderResult.filePath);
    await rm(tempDir, { recursive: true, force: true });

    return {
      artifactId: artifact.id,
      storageBucket: this.bucket,
      storagePath
    };
  }
}
