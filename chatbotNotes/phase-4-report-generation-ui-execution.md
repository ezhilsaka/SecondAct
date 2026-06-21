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
- Stage 3 generate report from portfolio detail: complete
- Stage 4 report status page and polling: complete
- Stage 5 PDF open/download flow: complete
- Stage 6 report history/list UI: complete
- Stage 7 failure, retry, and long-running state polish: complete
- Stage 8 local end-to-end report generation validation: not started
- Stage 9 full verification and quality gate: not started
- Stage 10 documentation updates: in progress through this execution file

Review checkpoint:

- User first requested implementation only through Step 1 and Step 2, then stop for review.
- User then requested implementation only through Step 3 and Step 4, then stop before Step 5.
- User then requested implementation only through Step 5 and Step 6, then stop before Step 7.
- User then requested implementation only through Step 7, then stop before Step 8.
- No UX clarification blocked Step 3 or Step 4 because the planning document already called for the ready portfolio action, compact USD/CAD selector, redirect to status page, and 2-3 second polling behavior.
- No UX clarification blocked Step 5 or Step 6 because the planning document already called for completion-only PDF access, friendly PDF errors, a Reports history route, live navigation, and portfolio-detail report previews.
- No UX clarification blocked Step 7 because the planning document already included failure-copy mapping, retry behavior, and calm long-running queued/processing copy.
- No backend knowledge base update was required for Step 3 through Step 7 because no new durable product clarification was discussed beyond the existing Phase 4 plan.

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

## 7) Stage 3: Generate Report From Portfolio Detail

Status: complete on 2026-06-20.

Goal:

- Replace the disabled report-generation placeholder on portfolio detail with the first real generate-report action.

Implemented:

- Added a server action at `src/app/app/reports/actions.ts`.
- The action reads `portfolioId` and `reportingCurrency` from form data.
- The action validates:
  - `portfolioId` as UUID
  - `reportingCurrency` as supported `USD` or `CAD`
- The action uses `requireAuthenticatedUser()` and never accepts a spoofable user ID from the browser.
- The action checks for an active report run before creating a new one.
- Active runs redirect to their existing status page instead of creating a duplicate queued job.
- New runs use `ReportRunService.createAndEnqueue()`.
- Successful submissions redirect to `/app/reports/[runId]`.
- Invalid currency redirects back to the portfolio detail with safe error copy.
- Portfolio-not-found errors redirect to the portfolio list with safe error copy.
- Generic create failures redirect back to portfolio detail with safe error copy.
- The portfolio detail readiness panel now renders:
  - disabled `Add holdings first` action while not ready
  - a report-generation form when ready
  - compact report currency selector with `CAD` and `USD`
  - default selected currency from the portfolio base currency
  - duplicate-submit damping through a pending submit button state

Focused tests:

- Not-ready portfolio renders blocked report action.
- Ready portfolio renders generate action and currency selector.
- Generate action validates currency before auth/service work.
- Generate action uses the authenticated user and ignores spoofed form user IDs.
- Generate action redirects new runs to the status page.
- Generate action redirects active runs to the existing status page.
- Portfolio-not-found errors return safe user-facing redirects.

Verification:

- `npm test -- --run src/app/app/reports/actions.test.ts src/app/app/reports/[runId]/ReportStatusPanel.test.tsx src/app/app/reports/[runId]/page.test.tsx src/app/app/portfolios/[portfolioId]/page.test.tsx`: passed, 19 tests across 4 files
- `npm run typecheck`: passed
- `npm run lint`: passed

## 8) Stage 4: Report Status Page And Polling

Status: complete on 2026-06-20.

Goal:

- Add the authenticated report status page that users land on after starting a report.

Implemented:

- Added `/app/reports/[runId]`.
- The status page validates `runId` before loading authenticated user state.
- The status page uses `requireAuthenticatedAppUser()`.
- The status page loads status through `ReportRunService.getStatus(runId, user.id)`.
- Not-found or not-owned report runs render Next.js `notFound()` without leaking IDs.
- Added a client status panel for polling.
- Polling runs only while status is:
  - `QUEUED`
  - `PROCESSING`
- Polling stops once status is terminal:
  - `COMPLETED`
  - `FAILED`
- Status panel shows:
  - status badge
  - user-facing status copy
  - source portfolio name
  - report currency
  - requested, started, completed, and failed timestamps
  - link back to the source portfolio
- Transient polling failures keep the page intact and show retry copy instead of replacing the current status.
- Internal pipeline JSON and raw provider details remain absent from the status UI.

Focused tests:

- Queued status render includes active polling copy.
- Processing status render includes active polling copy.
- Completed status render omits active polling copy.
- Failed status render omits active polling copy.
- Polling helper continues only for queued/processing.
- Polling refresh success returns the next status and clears retry copy.
- Polling refresh failure returns safe retry copy without throwing.
- Status page renders a source portfolio link.
- Status page loads status for the authenticated app user.
- Invalid run IDs return not found before user/service loading.
- Not-owned/missing report runs return not found.

Verification:

- `npm test -- --run src/app/app/reports/actions.test.ts src/app/app/reports/[runId]/ReportStatusPanel.test.tsx src/app/app/reports/[runId]/page.test.tsx src/app/app/portfolios/[portfolioId]/page.test.tsx`: passed, 19 tests across 4 files
- `npm run typecheck`: passed
- `npm run lint`: passed

## 9) Stage 5: PDF Open/Download Flow

Status: complete on 2026-06-20.

Goal:

- Let the user access the generated PDF after a report completes.

Implemented:

- Added `ReportDownloadButton` to the report status page.
- The PDF action renders only when the current status is `COMPLETED`.
- Non-completed statuses continue to show progress/failure copy without a PDF action.
- The button fetches `GET /api/v1/report-runs/:runId/pdf` on click.
- Successful signed URL responses open the PDF in a new tab.
- Signed URLs stay transient and are not stored as durable UI metadata.
- Missing artifacts map to:
  - `The PDF is not available yet. Try refreshing in a moment.`
- Signed URL failures, malformed success responses, and network failures map to retryable friendly copy.
- Browser popup blocking maps to a friendly local message.
- Existing authenticated PDF API behavior remains unchanged.

Focused tests:

- Completed run shows `Open PDF`.
- Queued run does not show `Open PDF`.
- Successful signed URL response opens the URL in a new tab.
- Artifact-not-found response maps to the planned friendly message.
- Signed URL error maps to retryable friendly copy.
- Malformed success response maps to retryable friendly copy.
- Existing PDF route tests still cover unauthorized, invalid run ID, missing run, artifact missing, signed URL failure, and successful response behavior.

Verification:

- `npm test -- --run src/app/app/reports/[runId]/ReportDownloadButton.test.tsx src/app/app/reports/[runId]/ReportStatusPanel.test.tsx src/app/api/v1/report-runs/[runId]/pdf/route.test.ts`: passed, 19 tests across 3 files
- `npm run typecheck`: passed
- `npm run lint`: passed

## 10) Stage 6: Report History/List UI

Status: complete on 2026-06-20.

Goal:

- Give the user a place to find report runs after leaving the status page.

Implemented:

- Added `/app/reports`.
- Reports page uses `requireAuthenticatedAppUser()`.
- Reports page loads user-owned report history through `ReportRunService.listReportRunsForUser(user.id, { limit: 50 })`.
- Reports navigation in `AppShell` is now live and links to `/app/reports`.
- Reports page renders an empty state when no reports exist.
- Reports page renders report rows with:
  - portfolio name
  - link to source portfolio
  - status
  - reporting currency
  - requested timestamp
  - completed/failed timestamp where applicable
  - action to open the status page
- Portfolio detail now loads a short user-scoped report preview through `ReportRunService.listReportRunsForUser(user.id, { portfolioId, limit: 3 })`.
- Portfolio detail preview shows:
  - active queued/processing report link when present
  - latest completed report link when present and no active run exists
  - short recent report history list
  - fallback link to all reports when the portfolio has no runs
- The portfolio-detail preview relies on the authenticated user ID and portfolio filter, so another user's report runs are not loaded into the view.
- No retry, failure-code mapping, or long-running state polish was added; those remain Stage 7.

Focused tests:

- Reports empty state renders.
- Reports list renders report rows.
- Report row links to status page.
- Reports navigation link is live.
- Portfolio detail shows active run link.
- Portfolio detail shows latest completed report link when no report is active.
- Portfolio detail loads report preview through authenticated user-scoped service call.
- Existing report-run service tests still cover user-owned listing, portfolio filtering, and not-owned portfolio rejection.

Verification:

- `npm test -- --run src/app/app/reports/page.test.tsx src/components/app/AppShell.test.tsx src/app/app/portfolios/[portfolioId]/page.test.tsx src/server/services/report-run-service.test.ts`: passed, 28 tests across 4 files
- `npm run typecheck`: passed
- `npm run lint`: passed

## 11) Stage 7: Failure, Retry, And Long-Running State Polish

Status: complete on 2026-06-20.

Goal:

- Make report failures understandable and recoverable without exposing internals.

Implemented:

- Added friendly failure-copy mapping for backend error codes:
  - `CANONICAL_FAILURE`
  - `MARKET_DATA_OR_CANONICAL_FAILURE`
  - `ANALYSIS_FAILURE`
  - `NARRATIVE_FAILURE`
  - `RENDER_FAILURE`
  - `PDF_FAILURE`
  - `STORAGE_FAILURE`
  - `ORCHESTRATION_FAILURE`
  - unknown or missing error codes
- Failure copy follows the Phase 4 plan's non-technical language and avoids raw implementation terms such as graphile-worker, canonical snapshot, narrative provider, artifact storage, and orchestration failure.
- Failed status page now shows the friendly failure reason.
- Failed status page now shows a retry form.
- Retry uses the existing authenticated report-generation server action.
- Retry submits the failed run's portfolio ID and reporting currency to create a fresh run.
- Retry keeps the failed run ID as non-authoritative context only; the server action ignores it for mutation and creates or redirects to a separate active/new run.
- Failed runs remain visible in `/app/reports` history.
- Queued and processing status pages now show calm long-running copy after the threshold.
- Long-running queued copy explains that in local development the report can remain queued until the background process is running.
- No local end-to-end pipeline validation was started; that remains Stage 8.

Focused tests:

- Known backend error codes map to expected friendly messages.
- Unknown and missing error codes map to generic friendly failure copy.
- Failed status renders friendly reason and retry action.
- Retry creates/redirects to a fresh report run instead of mutating the failed run.
- Failed report remains visible in report history.
- Long-running queued copy renders after the threshold.
- Long-running processing copy renders after the threshold.

Verification:

- `npm test -- --run src/app/app/reports/[runId]/ReportStatusPanel.test.tsx src/app/app/reports/actions.test.ts src/app/app/reports/page.test.tsx`: passed, 20 tests across 3 files
- `npm run typecheck`: passed
- `npm run lint`: passed

## 12) Current Stop Point

Stop requested by user:

- Complete only Step 7, then stop before Step 8.

Current stop point status:

- Step 1 is implemented and focused tests pass.
- Step 2 is implemented and focused tests pass.
- Step 3 is implemented and focused tests pass.
- Step 4 is implemented and focused tests pass.
- Step 5 is implemented and focused tests pass.
- Step 6 is implemented and focused tests pass.
- Step 7 is implemented and focused tests pass.
- Portfolio detail now starts report generation for ready portfolios.
- `/app/reports/[runId]` now displays authenticated report status with polling for active runs.
- Completed report status now exposes an `Open PDF` action.
- `/app/reports` now displays authenticated report history.
- Reports navigation is live.
- Portfolio detail now shows a user-scoped report preview.
- Failed report status now shows friendly failure copy and a retry action.
- Queued/processing status now shows calm long-running copy after the threshold.
- No Stage 8 local end-to-end report generation validation has been started yet.
- Stage 8 remains untouched.

Verification at this stop point:

- `npm test -- --run src/app/app/reports/actions.test.ts src/app/app/reports/[runId]/ReportStatusPanel.test.tsx src/app/app/reports/[runId]/page.test.tsx src/app/app/portfolios/[portfolioId]/page.test.tsx`: passed, 19 tests across 4 files
- `npm test -- --run src/app/app/reports/[runId]/ReportDownloadButton.test.tsx src/app/app/reports/[runId]/ReportStatusPanel.test.tsx src/app/api/v1/report-runs/[runId]/pdf/route.test.ts`: passed, 19 tests across 3 files
- `npm test -- --run src/app/app/reports/page.test.tsx src/components/app/AppShell.test.tsx src/app/app/portfolios/[portfolioId]/page.test.tsx src/server/services/report-run-service.test.ts`: passed, 28 tests across 4 files
- `npm test -- --run src/app/app/reports/[runId]/ReportStatusPanel.test.tsx src/app/app/reports/actions.test.ts src/app/app/reports/page.test.tsx`: passed, 20 tests across 3 files
- `npm run typecheck`: passed
- `npm run lint`: passed
- `npm test`: passed, 439 tests across 63 files
- `npm run build`: passed
- `git diff --check`: passed

Next planned step after user review:

- Stage 8: Local end-to-end report generation validation.
