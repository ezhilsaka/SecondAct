# Phase 4 Report Generation UI Execution

Last updated: 2026-06-20

## 1) Purpose

This file is the execution-memory companion to `phase-4-report-generation-ui-plan.md`.

The plan explains what Phase 4 intends to build.
This file records what was actually executed, what passed, what changed, and what remains.

Phase 4 goal:

`Ready portfolio -> Generate report -> Watch progress -> Download PDF -> Review report history`

## 2) Working Rules For Phase 4

- Keep Phase 4 focused on report-generation UI, report status, PDF access, and report history.
- Do not rebuild the Phase 1 report pipeline.
- Do not pull payment, email delivery, report sharing, broker import, CSV import, production worker hosting, or market-data provider migration into this phase.
- Preserve Phase 2 authenticated-session boundaries; do not reintroduce spoofable `X-User-Id` API auth.
- Keep raw pipeline JSON and raw provider errors out of browser/API responses.
- Add tests for every implementation step.
- Update this execution file as work progresses.
- Update `chatbotNotes/backend-knowledge-base.md` only when a durable clarification or product/functionality decision is made beyond the existing plan.

## 3) Current Phase Status

Current status:

- Stage 0 baseline and current-state audit: complete
- Stage 1 report-run history service and contracts: complete
- Stage 2 report-run API extensions: complete
- Stage 3 generate report from portfolio detail: not started
- Stage 4 report status page and polling: not started
- Stage 5 PDF open/download flow: not started
- Stage 6 report history/list UI: not started
- Stage 7 failure, retry, and long-running state polish: not started
- Stage 8 local end-to-end report generation validation: not started
- Stage 9 full verification and quality gate: not started
- Stage 10 documentation updates: in progress through this execution file

Review checkpoint:

- User requested implementation only through Step 1 and Step 2, then stop for review.
- No UX clarification blocked Step 1 or Step 2 because these steps are backend service/API contract work.
- No backend knowledge base update was required for Step 1 or Step 2 because no new durable product clarification was discussed beyond the existing Phase 4 plan.

## 4) Stage 0: Baseline And Current-State Audit

Status: complete on 2026-06-20.

Goal:

- Confirm Phase 4 starts from the completed Phase 3 portfolio workspace and existing report pipeline APIs.

Findings:

- Working tree was clean before implementation began.
- `src/app/app/portfolios/[portfolioId]/page.tsx` still rendered the disabled `Report generation comes next` action.
- Existing report API route state:
  - `POST /api/v1/report-runs` existed and used `getAuthenticatedApiUserId()`.
  - `GET /api/v1/report-runs/:runId` existed and used `getAuthenticatedApiUserId()`.
  - `GET /api/v1/report-runs/:runId/pdf` existed and used `getAuthenticatedApiUserId()`.
  - `GET /api/v1/report-runs` listing/history did not exist yet.
- `ReportRunService` already supported create/enqueue, status lookup, and signed URL lookup.
- `report_runs` and `report_artifacts` already supported Phase 4 without a Prisma schema migration.
- `Reports` navigation in `AppShell` was still disabled.

Baseline verification:

- `npm test`: passed, 397 tests across 58 files
- `npm run typecheck`: passed
- `npm run lint`: passed
- `npm run build`: passed

## 5) Stage 1: Report-Run History Service And Contracts

Status: complete on 2026-06-20.

Goal:

- Add backend service support for report history/listing and active-run detection.

Implemented:

- Extended `src/server/services/report-run-service.ts`.
- Added safe report-run summary result mapping:
  - `runId`
  - `portfolioId`
  - `portfolioName`
  - `status`
  - `paymentStatus`
  - `reportingCurrency`
  - `errorCode`
  - `requestedAt`
  - `startedAt`
  - `completedAt`
  - `failedAt`
- Kept internal pipeline JSON and error details out of service results:
  - `canonicalSnapshot`
  - `analysisOutput`
  - `narrativeOutput`
  - `errorDetails`
- Added repository support for listing user-owned report runs.
- Added optional portfolio filtering.
- Added a separate `verifyPortfolioBelongsToUser()` repository method for report history filtering.
  - This intentionally does not require `archivedAt: null`, so old report runs for archived-but-owned portfolios can remain viewable later.
  - Existing `verifyPortfolioOwnership()` for creating new report runs remains active-portfolio-only.
- Added `findActiveReportRunForPortfolio()` for future duplicate active-run prevention.
- Active report runs are limited to:
  - `QUEUED`
  - `PROCESSING`
- Added `portfolioName` to `getStatus()` result metadata for later status-page UI.

Focused tests:

- List all user-owned runs.
- List runs for one owned portfolio.
- Not-owned portfolio filtering throws without leaking runs.
- Active run helper finds queued/processing runs.
- Completed/failed runs do not count as active.
- Response metadata does not expose internal JSON blobs or error details.

Verification:

- `npm test -- --run src/server/services/report-run-service.test.ts`: passed, 19 tests

## 6) Stage 2: Report-Run API Extensions

Status: complete on 2026-06-20.

Goal:

- Expose report history/listing through authenticated API routes.

Implemented:

- Added `GET /api/v1/report-runs` to `src/app/api/v1/report-runs/route.ts`.
- Preserved existing `POST /api/v1/report-runs` behavior.
- Added optional query params:
  - `portfolioId`: optional UUID filter
  - `limit`: optional integer, 1 through 50
- Query validation failures return:
  - status `400`
  - error code `VALIDATION_ERROR`
- Unauthenticated list requests return:
  - status `401`
  - error code `UNAUTHORIZED`
- Not-owned portfolio filters return:
  - status `404`
  - error code `PORTFOLIO_NOT_FOUND`
- List route uses the authenticated Supabase session user ID and ignores spoofed `x-user-id` headers.
- Added `portfolioName` to existing report status route test fixtures to cover the additive status metadata.
- Existing status and PDF routes remain authenticated and ownership-scoped through `ReportRunService`.

Focused tests:

- Unauthenticated list request returns `401`.
- Valid list request returns user-owned runs.
- Spoofed `x-user-id` header is ignored.
- Portfolio filter scopes through the service.
- Limit filter scopes through the service.
- Invalid `portfolioId` returns `400`.
- Invalid `limit` returns `400`.
- Not-owned portfolio filter returns safe `404`.
- Existing create/status/PDF route tests still pass.

Verification:

- `npm test -- --run src/app/api/v1/report-runs/route.test.ts src/app/api/v1/report-runs/[runId]/route.test.ts src/app/api/v1/report-runs/[runId]/pdf/route.test.ts`: passed, 26 tests across 3 files
- `npm run typecheck`: passed
- `npm run lint`: passed
- `npm test`: passed, 409 tests across 58 files
- `npm run build`: passed
- `git diff --check`: passed

## 7) Current Stop Point

Stop requested by user:

- Complete only Step 1 and Step 2, then stop for review.

Current stop point status:

- Step 1 is implemented and focused tests pass.
- Step 2 is implemented and focused tests pass.
- Stage 3 has not been started.
- No portfolio detail UI changes have been made yet.
- No report status page, polling UI, PDF button, report history page, or Reports navigation activation has been started yet.

Next planned step after user review:

- Stage 3: Generate report from portfolio detail.
