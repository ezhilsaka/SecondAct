# Phase 1 Plan (V1): Portfolio to PDF Pipeline

Last updated: 2026-03-24

## 1) Goal

Build the core backend pipeline for one testable outcome:

`Canonical Model -> Analysis Engine -> Narrative Engine -> PDF Generator`

This phase ends when a seeded user portfolio can produce a downloadable PDF report.

## 2) Scope Boundaries (Locked)

Included:
- User-linked portfolio and report run data model
- Market data enrichment via provider abstraction
- Deterministic analysis computation
- Narrative generation from computed outputs only
- PDF rendering and storage
- API to start run, check status, and fetch PDF
- Compatibility hooks for future payment/email/save flows

Excluded (later phases):
- Checkout/payment flow
- Full user onboarding/auth UX
- Portfolio import UX
- Orders/history UI
- Post-PDF product workflows

## Critical Requirement (Explicit)

In this phase, we create and use **real Supabase resources**:
- real Supabase Postgres tables (not mock tables)
- real Supabase Storage bucket for PDF artifacts
- real migrations applied to the Supabase database

## 3) Architecture Style (Locked)

- API-first, microservice-ready, modular architecture
- Not fully distributed microservices on day 1
- Clean module boundaries so each module can be extracted to its own service later

## 4) Locked Technical Decisions

- Database: Supabase Postgres
- Artifact storage: Supabase Storage
- Queue: Postgres-backed queue (`graphile-worker`)
- PDF engine: HTML + Playwright
- Market data (dev build): `yfinance` via Python adapter
- Narrative: `NarrativeProvider` abstraction (local/open-source LLM for dev, production provider later)
- User linkage: all portfolio/report entities tracked by `user_id`
- Usage tracking: `reports_generated_count` (or equivalent user usage table)

## 5) Target Modules

1. `PortfolioRepository`
2. `MarketDataProvider` (`YFinanceProvider` implementation for current build)
3. `CanonicalModelService`
4. `AnalysisEngine` (deterministic)
5. `NarrativeProvider` (LLM adapter)
6. `PdfRenderer` (Playwright)
7. `ReportRunOrchestrator` (job worker)

## 6) Data Model (Phase 1)

## Core tables

1. `users` (existing or seeded for backend testing)
2. `portfolios`
3. `portfolio_holdings`
4. `report_runs`
5. `report_artifacts`
6. `user_usage`

## Required ownership and tracking fields

- `portfolios.user_id`
- `report_runs.user_id`
- `report_runs.portfolio_id`
- `report_artifacts.report_run_id`
- `user_usage.user_id`
- `user_usage.reports_generated_count`
- `report_runs.status` lifecycle (target model):
  - `draft -> awaiting_payment -> queued -> processing -> completed|failed`
- `report_runs.payment_status` compatibility field:
  - `not_required|pending|paid|failed|refunded`
- Optional future linking fields (add now or reserve in migration plan):
  - `report_runs.payment_reference_id`
  - `report_runs.payment_provider`

## 7) API Contracts (Phase 1)

1. `POST /api/v1/report-runs`
   - Input: `portfolioId`
   - Action: validates ownership, creates run record, enqueues job
   - Output: `runId`, initial status

2. `GET /api/v1/report-runs/:runId`
   - Action: returns status and metadata
   - Output: status (`draft|awaiting_payment|queued|processing|completed|failed`), `payment_status`, timestamps, error if any

3. `GET /api/v1/report-runs/:runId/pdf`
   - Action: returns signed URL or streams PDF for completed run
   - Output: PDF access for test validation

## 8) Execution Flow

1. API receives `portfolioId` for a specific `user_id`.
2. API creates `report_runs` row.
   - Phase 1 test path: move directly to `queued`.
   - Future payment path: hold at `awaiting_payment` until payment confirmation.
3. API enqueues job when run is eligible to execute.
4. Worker fetches holdings and validates portfolio ownership.
5. Worker calls `MarketDataProvider` to enrich holdings (quote + metadata).
6. Worker builds versioned canonical snapshot.
7. Worker runs deterministic analysis modules.
8. Worker calls `NarrativeProvider` with computed JSON only.
9. Worker renders PDF from structured HTML template via Playwright.
10. Worker uploads PDF to Supabase Storage and writes artifact metadata.
11. Worker updates `report_runs` to `completed` and increments usage counter.
12. Worker emits domain event `report.completed` for future integrations (email/save/library).

## 9) Step-by-Step Implementation Guide

## Step 0: Provision real Supabase resources (required in this phase)
- Create/select Supabase project for backend development.
- Create a dedicated Storage bucket for report PDFs.
- Set project secrets in `.env` (`DATABASE_URL`, `DIRECT_URL`, Supabase keys, storage bucket name).
- Confirm Node app and worker can connect to Supabase Postgres before any code implementation.

## Step 1: Baseline project setup
- Install dependencies for Prisma, queue, Playwright, schema validation, and HTTP client.
- Add environment variable placeholders for DB, storage, queue worker, narrative provider, and Python market-data service URL.
- Add a `src/server` folder for backend modules (keep UI and backend separate).

## Step 2: Create real Supabase tables via Prisma migrations
- Add Prisma schema for Phase 1 tables.
- Implement migrations with foreign keys and indexes for:
  - `user_id`
  - `portfolio_id`
  - `report_run_id`
  - `status`
  - `payment_status`
  - `created_at`
- Apply migrations to the **Supabase database** (remote/dev instance for this project).
- Verify all tables and constraints exist in Supabase dashboard and SQL editor.
- Seed one test user and one test portfolio with holdings in Supabase tables.

## Step 3: Define core interfaces first
- Add TypeScript interfaces:
  - `MarketDataProvider`
  - `NarrativeProvider`
  - `PdfRenderer`
- Add typed contracts for:
  - canonical snapshot
  - analysis output
  - narrative output
  - report metadata

## Step 4: Build Python market-data adapter (`yfinance`)
- Create a small FastAPI service:
  - `POST /market-data/quotes`
  - accepts ticker list, returns normalized quote payload
- Add timeouts, retry policy, and clear error responses.
- Return normalized shape only (no provider-specific leakage into Node service).

## Step 5: Build Node market-data client
- Add `YFinanceProvider` implementation in Node that calls FastAPI adapter.
- Enforce strict mapping from provider response to internal contract.
- Add fallback behavior for missing data (flag low-confidence fields).

## Step 6: Canonical model service
- Build canonical snapshot from holdings + market enrichment.
- Stamp snapshot with:
  - `schemaVersion`
  - `generatedAt`
  - `dataQualityFlags`
- Persist snapshot JSON to `report_runs`.

## Step 7: Deterministic analysis engine
- Implement these modules first:
  - Portfolio Snapshot
  - P&L Summary
  - Concentration + HHI
  - Winners vs Losers
  - Static Stress Tests
- Keep all formulas deterministic and auditable.
- Persist analysis JSON to `report_runs`.

## Step 8: Narrative engine integration
- Implement `NarrativeProvider` for local LLM endpoint (dev build).
- Prompt must consume computed analysis JSON only.
- Enforce constraints:
  - no buy/sell advice
  - include uncertainty language for low-confidence data
- Persist narrative JSON to `report_runs`.

## Step 9: PDF generation
- Build HTML template with fixed chapter order:
  - Executive summary
  - Analysis sections
  - Methodology and assumptions
  - Mandatory disclaimer
- Render with Playwright to PDF.
- Save local temp artifact before upload.

## Step 10: Storage and artifact metadata
- Upload PDF to Supabase Storage.
- Save metadata in `report_artifacts`:
  - storage path
  - byte size
  - checksum
  - mime type

## Step 11: Queue and worker orchestration
- Configure `graphile-worker`.
- Job handler updates status transitions:
  - Phase 1 execution path: `queued -> processing -> completed|failed`
  - Reserved payment path: `draft -> awaiting_payment -> queued`
- On success:
  - link artifact
  - increment `user_usage.reports_generated_count`
  - emit `report.completed` event payload with `runId`, `userId`, `portfolioId`, `artifactId`
- On failure:
  - persist structured error code and details
  - emit `report.failed` event payload with error metadata

## Step 12: API route implementation
- Build:
  - `POST /api/v1/report-runs`
  - `GET /api/v1/report-runs/:runId`
  - `GET /api/v1/report-runs/:runId/pdf`
- Add request validation and user-scoped authorization checks.
- In Phase 1 test path, `POST /report-runs` should move run to `queued` and enqueue immediately.
- Keep `awaiting_payment` path guarded by feature flag/config for future activation.

## Step 13: Observability and reliability
- Structured logs with `runId`, `userId`, `portfolioId`.
- Basic timing metrics per stage.
- Include `status` and `payment_status` transitions in logs for auditability.
- Error classification:
  - market-data failure
  - narrative failure
  - PDF failure
  - storage failure

## Step 14: End-to-end validation
- Execute full run with seeded user and portfolio.
- Verify:
  - completed status
  - persisted canonical/analysis/narrative payloads
  - downloadable PDF output
  - usage counter increment

## 10) Acceptance Criteria (Phase 1 Done)

1. A seeded user can trigger a report run from API.
2. System completes full pipeline and stores outputs.
3. Generated PDF is downloadable and human-readable.
4. Report run is fully traceable by `runId`.
5. All portfolio/report records are linked to `user_id`.
6. Usage tracking (`reports_generated_count`) is updated.
7. Status lifecycle and `payment_status` fields are present and queryable for future payment integration.
8. Event hooks (`report.completed` and `report.failed`) are emitted for future email/save actions.
9. Real Supabase tables and constraints are created and validated in the target Supabase project.

## 11) Extraction Path to Full Microservices (Future)

When ready, extract these modules to independent services without contract changes:
- Market Data Service (already separate in Python)
- Analysis Service
- Narrative Service
- PDF Service
- Orchestrator/Workflow Service

Current design keeps those seams stable from day 1.
