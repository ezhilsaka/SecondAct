# Phase 1 Architecture Map

Last updated: 2026-04-04

## 1) Purpose

This file is a concise architecture map of the current Phase 1 backend/report system.

It answers four practical questions:

- what the product is trying to prove in Phase 1
- what components exist in the system
- how data moves from portfolio input to final report output
- what is implemented now versus what is still pending

## 2) Product Outcome Being Proven

Phase 1 is proving one core backend outcome:

`User-linked portfolio -> canonical snapshot -> deterministic analysis -> narrative -> PDF artifact`

The immediate product goal is not full onboarding or a complete customer flow.
The Phase 1 goal is to prove that a seeded portfolio can eventually become a downloadable, user-linked report artifact.

## 3) System Shape

The current system is best understood as:

- a Next.js app for the website and future API routes
- a TypeScript backend boundary under `src/server`
- a Supabase Postgres database for user, portfolio, and report data
- a Supabase Storage bucket for future PDF artifacts
- a Python FastAPI internal service for market data
- a future worker/orchestrator path for running report-generation stages asynchronously

Architecturally, it is not a full microservice system yet.
It is a modular monolith with clean extraction seams.

## 4) Major Runtime Components

### A. Frontend / App Shell

Current role:

- marketing site
- legal page
- health route
- future home for report-run API routes

Relevant paths:

- `src/app`
- `src/components`

### B. Backend Module Boundary (`src/server`)

Current role:

- holds server-only logic for the report pipeline
- keeps backend code separated from App Router UI code
- defines contracts, providers, modules, queue entrypoints, and renderers

Main sub-areas:

- `config`: env parsing and runtime validation
- `contracts`: typed payload boundaries between stages
- `modules`: business logic stages such as canonical-model and analysis-engine
- `providers`: external-service boundaries such as market data and future narrative generation
- `queue`: worker baseline and future job orchestration
- `renderers`: future PDF generation boundary
- `shared`: constants and shared server-only types

### C. Database Layer

Platform:

- Supabase Postgres via Prisma

Current role:

- stores app-owned users, portfolios, holdings, report runs, report artifacts, and usage
- persists frozen run-level pipeline outputs on `report_runs`

Core tables:

- `user_profiles`
- `portfolios`
- `portfolio_holdings`
- `report_runs`
- `report_artifacts`
- `user_usage`

Important design rule:

- portfolios are long-lived user-owned objects
- report runs are point-in-time generation events for a portfolio
- report data is frozen onto the run for reproducibility and auditability

### D. Market Data Service Boundary

System split:

- Node/TypeScript does not call Yahoo directly
- Node calls an internal Python FastAPI adapter
- Python adapter talks to the actual provider, currently `yfinance`

Why this exists:

- provider isolation
- normalized provider-neutral responses
- easier future provider swap
- cleaner separation between report logic and quote-fetching logic

Current request path:

`CanonicalModelService -> MarketDataAdapterProvider (Node) -> FastAPI adapter -> YFinanceProvider`

### E. Canonical Model Stage

Current role:

- takes a report run plus portfolio holdings
- enriches holdings with normalized market data
- computes frozen holding-level and portfolio-level values
- persists a validated canonical snapshot to `report_runs.canonical_snapshot`

This stage creates the report run's frozen source-of-truth input artifact.

### F. Deterministic Analysis Stage

Current role:

- reads the persisted canonical snapshot
- computes auditable, deterministic analysis sections
- persists validated analysis output to `report_runs.analysis_output`

This stage is the quantitative source of truth for later narrative generation.

### G. Narrative Stage

Planned role:

- consume computed analysis output only
- generate structured narrative sections and executive summary
- persist `report_runs.narrative_output`

Current status:

- contract exists
- provider interface exists
- implementation is not built yet

### H. Report Assembly and PDF Stage

Planned role:

- assemble canonical snapshot, analysis, narrative, and compliance block into a final report document
- render HTML to PDF via Playwright
- upload PDF to Supabase Storage
- persist artifact metadata in `report_artifacts`

Current status:

- contracts exist
- renderer interface exists
- implementation is not built yet

### I. Queue / Orchestrator Stage

Planned role:

- drive the report run lifecycle asynchronously
- manage status transitions
- call each stage in order
- persist failures and completion state
- emit future integration events

Current status:

- worker baseline exists
- full orchestration path is not built yet

## 5) End-to-End Data Flow

The intended Phase 1 runtime flow is:

1. A user-owned portfolio exists in Supabase.
2. A report run is created for that portfolio.
3. The system loads the report run, portfolio, and holdings.
4. The canonical model stage requests normalized quote data from the Python market-data adapter.
5. The canonical model stage computes a frozen canonical snapshot and stores it on `report_runs`.
6. The analysis stage reads that snapshot and computes deterministic analytics.
7. The analysis output is stored on `report_runs`.
8. A future narrative provider will convert deterministic analysis into structured prose.
9. A future report assembler/PDF renderer will build a final document and PDF.
10. The future PDF artifact will be uploaded to Supabase Storage.
11. Artifact metadata will be stored in `report_artifacts`.
12. The report run status will be marked completed or failed.

## 6) Current Persistence Model

The report run is the main pipeline record.

It currently holds or is designed to hold:

- identity and ownership: `user_id`, `portfolio_id`
- lifecycle state: `status`, `payment_status`
- frozen run metadata: reporting currency, provider names, versions, timestamps
- stage outputs:
  - `canonical_snapshot`
  - `analysis_output`
  - `narrative_output` (planned next)
- failure information:
  - `error_code`
  - `error_details`

This means each report run is intended to be inspectable as a durable pipeline record, not just a temporary job.

## 7) Current Implementation Status

Implemented and verified:

- real Supabase-backed schema and seed data
- Prisma runtime/client setup
- server env parsing and validation
- report-pipeline contract layer
- Python market-data adapter service
- Node market-data provider client
- canonical snapshot builder/service with persistence
- deterministic analysis engine/service with persistence
- marketing-site shell and health endpoint

Defined but not yet implemented:

- report-run API routes
- narrative provider implementation
- report document assembly logic
- PDF template and Playwright rendering flow
- storage upload flow for generated PDFs
- full queue/orchestrator execution path

## 8) What Is True About The Architecture Right Now

These statements are accurate as of the current codebase:

- the project is backend-first for Phase 1, not feature-complete end to end
- the quantitative core is real through deterministic analysis
- the narrative/PDF half of the pipeline is still a planned seam, not a running feature
- the database model is already shaped for future auth, payment, usage, and artifact flows
- the market-data adapter boundary is one of the clearest long-term architectural seams in the system
- the `report_runs` table is the center of the report pipeline lifecycle

## 9) Practical Next Build Sequence

The clean next implementation order is:

1. build the narrative engine and persist `narrative_output`
2. build report document assembly from validated stage outputs
3. build HTML-to-PDF rendering with Playwright
4. build artifact upload and `report_artifacts` persistence
5. build the real report-run orchestrator/worker path
6. expose report-run lifecycle APIs for creation, status, and PDF retrieval

## 10) One-Sentence Summary

Second Act Phase 1 is a modular, Supabase-backed report pipeline where the data model, market-data boundary, canonical snapshot stage, and deterministic analysis stage are already real, while narrative generation, PDF rendering, and orchestration are the next major layers still to be built.