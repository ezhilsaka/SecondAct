-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PortfolioSourceType" AS ENUM ('MANUAL', 'IMPORTED');

-- CreateEnum
CREATE TYPE "AssetClassType" AS ENUM ('EQUITY');

-- CreateEnum
CREATE TYPE "SupportedCurrency" AS ENUM ('USD', 'CAD');

-- CreateEnum
CREATE TYPE "ReportRunStatus" AS ENUM ('DRAFT', 'AWAITING_PAYMENT', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentStatusType" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('PDF_REPORT');

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "investor_handle" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "base_currency" "SupportedCurrency" NOT NULL,
    "source_type" "PortfolioSourceType" NOT NULL DEFAULT 'MANUAL',
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_holdings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "portfolio_id" UUID NOT NULL,
    "ticker" TEXT NOT NULL,
    "security_name" TEXT,
    "asset_class" "AssetClassType" NOT NULL DEFAULT 'EQUITY',
    "security_currency" "SupportedCurrency" NOT NULL,
    "quantity" DECIMAL(28,10) NOT NULL,
    "average_cost" DECIMAL(20,8) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "portfolio_holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "portfolio_id" UUID NOT NULL,
    "reporting_currency" "SupportedCurrency" NOT NULL,
    "status" "ReportRunStatus" NOT NULL DEFAULT 'DRAFT',
    "payment_status" "PaymentStatusType" NOT NULL DEFAULT 'NOT_REQUIRED',
    "payment_provider" TEXT,
    "payment_reference_id" TEXT,
    "schema_version" TEXT,
    "prompt_version" TEXT,
    "market_data_provider" TEXT,
    "narrative_provider" TEXT,
    "narrative_model" TEXT,
    "valuation_as_of" TIMESTAMPTZ(6),
    "canonical_snapshot" JSONB,
    "analysis_output" JSONB,
    "narrative_output" JSONB,
    "error_code" TEXT,
    "error_details" JSONB,
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "failed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "report_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_artifacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "report_run_id" UUID NOT NULL,
    "artifact_type" "ArtifactType" NOT NULL DEFAULT 'PDF_REPORT',
    "storage_bucket" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "checksum_sha256" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_usage" (
    "user_id" UUID NOT NULL,
    "reports_generated_count" INTEGER NOT NULL DEFAULT 0,
    "last_report_generated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_usage_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_email_key" ON "user_profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_investor_handle_key" ON "user_profiles"("investor_handle");

-- CreateIndex
CREATE INDEX "user_profiles_created_at_idx" ON "user_profiles"("created_at");

-- CreateIndex
CREATE INDEX "portfolios_user_id_created_at_idx" ON "portfolios"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "portfolios_user_id_archived_at_idx" ON "portfolios"("user_id", "archived_at");

-- CreateIndex
CREATE INDEX "portfolio_holdings_user_id_portfolio_id_idx" ON "portfolio_holdings"("user_id", "portfolio_id");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_holdings_portfolio_id_ticker_key" ON "portfolio_holdings"("portfolio_id", "ticker");

-- CreateIndex
CREATE INDEX "report_runs_user_id_created_at_idx" ON "report_runs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "report_runs_portfolio_id_created_at_idx" ON "report_runs"("portfolio_id", "created_at");

-- CreateIndex
CREATE INDEX "report_runs_status_created_at_idx" ON "report_runs"("status", "created_at");

-- CreateIndex
CREATE INDEX "report_runs_payment_status_created_at_idx" ON "report_runs"("payment_status", "created_at");

-- CreateIndex
CREATE INDEX "report_artifacts_user_id_created_at_idx" ON "report_artifacts"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "report_artifacts_report_run_id_artifact_type_key" ON "report_artifacts"("report_run_id", "artifact_type");

-- CreateIndex
CREATE UNIQUE INDEX "report_artifacts_storage_bucket_storage_path_key" ON "report_artifacts"("storage_bucket", "storage_path");

-- AddForeignKey
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_holdings" ADD CONSTRAINT "portfolio_holdings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_holdings" ADD CONSTRAINT "portfolio_holdings_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_runs" ADD CONSTRAINT "report_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_runs" ADD CONSTRAINT "report_runs_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_artifacts" ADD CONSTRAINT "report_artifacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_artifacts" ADD CONSTRAINT "report_artifacts_report_run_id_fkey" FOREIGN KEY ("report_run_id") REFERENCES "report_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_usage" ADD CONSTRAINT "user_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

