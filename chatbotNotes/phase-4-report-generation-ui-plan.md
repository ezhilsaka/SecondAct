# Phase 4 Plan: Report Generation UI

Last updated: 2026-06-20

## 1) Purpose

This document is the implementation handoff plan for Phase 4.

Phase 1 proved the backend report pipeline:

`Portfolio -> Canonical Model -> Analysis Engine -> Narrative Engine -> PDF Generator -> Supabase Storage`

Phase 2 created the authenticated app foundation:

`Supabase Auth -> protected app shell -> profile bootstrap -> authenticated APIs`

Phase 3 completed the portfolio workspace:

`Create portfolio -> add holdings -> review readiness`

Phase 4 should turn a ready portfolio into a real user-facing report-generation experience:

`Ready portfolio -> Generate report -> Watch progress -> Download PDF -> Review report history`

The goal is to let a signed-in DIY investor generate a report from the portfolio UI, understand what is happening while the backend worker runs, and download the completed PDF without needing Postman, database access, or worker knowledge.

## 2) Product Strategy Context

Second Act is built for DIY investors who want a plain-English portfolio diagnostic report without a monthly subscription or broker connection.

Phase 4 is the first phase where the core product promise becomes visible inside the authenticated app:

- the user already entered holdings in Phase 3
- the backend already knows how to generate a PDF from a portfolio
- Phase 4 connects those two pieces with a calm, understandable UI

The report-generation UX should feel like:

1. "My portfolio is ready."
2. "I can generate a report now."
3. "The app is working on it; I do not need to stay on one screen anxiously."
4. "If something fails, I understand roughly what happened."
5. "When it succeeds, I can open or download the PDF."
6. "I can find my previous reports later."

Important product tone:

- Use simple status language.
- Avoid queue/worker/internal pipeline jargon.
- Do not expose raw error details to the user.
- Do not present market-data or AI failures as the user's fault.
- Keep the copy encouraging but honest.
- Do not add buy/sell advice, tax advice, or legal advice.

## 3) Current Starting Point

Phase 3 is complete as of `chatbotNotes/phase-3-portfolio-management-mvp-execution.md`.

Important completed Phase 3 evidence:

- Portfolio list/create/edit/archive flows are implemented.
- Portfolio detail page is implemented.
- Holdings add/edit/remove flows are implemented.
- API-backed ticker search/autocomplete is implemented.
- Manual ticker entry remains available.
- Portfolio readiness is implemented:
  - `Needs holdings`
  - `Ready for report`
- Dashboard integration is implemented.
- The portfolio detail page currently shows a disabled action:
  - `Report generation comes next`
- The disabled report action does not call `POST /api/v1/report-runs`.
- The deferred Phase 2 owned-portfolio report API smoke was closed through automated route/service tests.
- Final Phase 3 quality gate passed:
  - `npm test`: 392 tests across 56 files
  - `npm run typecheck`
  - `npm run lint`
  - `services/market-data-adapter/.venv/bin/pytest services/market-data-adapter/tests`: 24 tests
  - `npm run build`

Existing report APIs from Phase 1 and Phase 2:

- `POST /api/v1/report-runs`
  - authenticated
  - body requires `portfolioId` and `reportingCurrency`
  - verifies portfolio ownership
  - creates a `QUEUED` report run
  - enqueues a graphile-worker job
  - returns `{ runId, status: "QUEUED" }`
- `GET /api/v1/report-runs/:runId`
  - authenticated
  - verifies run ownership
  - returns run status metadata
- `GET /api/v1/report-runs/:runId/pdf`
  - authenticated
  - verifies run ownership
  - returns a Supabase signed URL when the run is completed and the PDF artifact exists

Existing report backend behavior:

- The API request returns quickly after enqueueing.
- The worker runs asynchronously.
- The worker processes one report sequentially:
  - canonical snapshot
  - analysis
  - narrative
  - report document assembly
  - PDF render
  - storage upload
  - mark run completed
- `report_runs.status` moves through:
  - `QUEUED -> PROCESSING -> COMPLETED|FAILED`
- Payment-ready statuses exist in the schema but are not part of the current happy path:
  - `DRAFT`
  - `AWAITING_PAYMENT`
- `PAYMENT_GATE_ENABLED` currently defaults to `false`.

Important current files:

- `chatbotNotes/phase-3-portfolio-management-mvp-execution.md`
- `chatbotNotes/backend-knowledge-base.md`
- `chatbotNotes/production-readiness.md`
- `src/app/app/portfolios/[portfolioId]/page.tsx`
- `src/app/app/page.tsx`
- `src/app/api/v1/report-runs/route.ts`
- `src/app/api/v1/report-runs/[runId]/route.ts`
- `src/app/api/v1/report-runs/[runId]/pdf/route.ts`
- `src/server/services/report-run-service.ts`
- `src/server/queue/worker.ts`
- `src/server/orchestrators/report-run-orchestrator.ts`
- `src/db/prisma/schema.prisma`
- `services/market-data-adapter/README.md`

## 4) Phase 4 Product Outcome

By the end of Phase 4, a signed-in user should be able to:

1. Open `/app`.
2. Open a portfolio from `/app/portfolios`.
3. See a clear not-ready message if the portfolio has no holdings.
4. See an enabled report-generation action when the portfolio is ready.
5. Choose or confirm the reporting currency for the run.
6. Start report generation from the portfolio detail page.
7. Land on a report status page for that run.
8. See queued and processing states while the worker runs.
9. Refresh the page without losing the run status.
10. See a completed state when the report is ready.
11. Open or download the generated PDF through a signed URL.
12. See a failed state with a friendly explanation and a safe retry path.
13. Navigate to a report history/list page.
14. See previous report runs that belong only to the signed-in user.
15. Return from a report run to its portfolio.

## 5) Scope

### In Scope

- Replace the disabled `Report generation comes next` placeholder with a real generate-report flow for ready portfolios.
- Keep not-ready portfolios blocked from report generation with clear copy.
- Add report currency selection or confirmation, defaulting to the portfolio base currency.
- Create report runs from the app UI using the authenticated user session.
- Redirect to a dedicated report status page after run creation.
- Poll report status from the browser.
- Show `QUEUED`, `PROCESSING`, `COMPLETED`, and `FAILED` states.
- Defensively handle `DRAFT` and `AWAITING_PAYMENT` statuses even though they are not expected in the Phase 4 happy path.
- Fetch a signed PDF URL only when the user opens/downloads the completed report.
- Add report history/listing support.
- Add a Reports navigation entry in the app shell.
- Add portfolio-detail report history/latest report context.
- Add user-friendly failure copy mapped from backend error codes.
- Add tests for service/API changes, app actions, status polling behavior, and UI states.
- Run at least one local full report-generation validation when the worker, market-data adapter, Supabase, and narrative provider are available.
- Update Phase 4 execution notes as work progresses.

### Out Of Scope

- Payment/checkout.
- Enforcing paid entitlements.
- Email delivery of completed reports.
- Report sharing links.
- Report deletion/purge workflows.
- Broker import.
- CSV import.
- PDF template/report quality redesign.
- New analysis metrics.
- Rebalancing metrics.
- Production worker hosting.
- Production market-data provider migration.
- Vercel-only full report generation unless the worker and market-data service are also production-hosted.
- Full table-by-table RLS hardening unless the user explicitly pulls security hardening into this phase.

## 6) Key Product Decisions For Phase 4

### 6.1 Status UX

Recommendation:

- Use a dedicated `/app/reports/[runId]` status page.

Why:

- The user can refresh the page safely.
- The user can leave and come back.
- A status page is easier to link from report history.
- It keeps the portfolio detail page from becoming too busy.

The portfolio detail page should still show helpful report context:

- latest report status
- active run link if a report is already generating
- short report history preview

### 6.2 Polling Instead Of Realtime

Recommendation:

- Use browser polling for Phase 4.

Why:

- The backend already exposes `GET /api/v1/report-runs/:runId`.
- Polling is simple, reliable, and enough for a report that usually takes tens of seconds.
- Realtime, SSE, or WebSockets can be added later if real usage shows a need.

Suggested polling behavior:

- Poll every 2-3 seconds while status is `QUEUED` or `PROCESSING`.
- Stop polling when status is `COMPLETED` or `FAILED`.
- Pause or slow down after a long wait, for example after 10 minutes.
- Provide a manual refresh action.
- Avoid showing scary timeout language; say the report is still taking longer than usual.

### 6.3 Reporting Currency

Recommendation:

- Default reporting currency to the portfolio base currency.
- Show a compact `Report currency` selector with `USD` and `CAD`.

Why:

- The backend already supports `reportingCurrency` separately from portfolio base currency.
- The portfolio base currency is the least surprising default.
- Keeping the selector visible helps validate the base-currency/reporting-currency distinction we already built.

If the user wants the simplest possible UX during execution, this can be changed to a default-only hidden input for Phase 4 and expanded later.

### 6.4 Duplicate / Active Run Handling

Recommendation:

- Prevent accidental duplicate report generation from the app UI.

Minimum Phase 4 behavior:

- Disable the generate button while the create request is in flight.
- If the portfolio already has an active `QUEUED` or `PROCESSING` run, show `Report already generating` and link to the active status page.
- Do not silently create multiple active runs from repeated clicks.

Recommended service support:

- Add a report-run list/history method that can identify active runs for a portfolio.
- The app action can redirect to the active run instead of creating another one.

Do not add a database-level partial unique constraint in Phase 4 unless testing shows UI/service guards are not enough. A stricter server-side idempotency/locking pass can be a later hardening item if report volume or cost risk requires it.

### 6.5 Signed PDF URL Handling

Recommendation:

- Do not store signed URLs in React state as durable report metadata.
- Request a signed URL on demand when the user clicks `Open PDF` or `Download PDF`.

Why:

- Signed URLs expire.
- The current endpoint already returns `{ signedUrl, expiresInSeconds }`.
- If a URL expires, requesting a new one is cheap and clear.

## 7) Data Model Fit

No Prisma schema migration is expected for Phase 4.

Existing tables already support the MVP:

### `report_runs`

Phase 4 usage:

- one row per report-generation attempt
- user-owned through `user_id`
- linked to a portfolio through `portfolio_id`
- status displayed in the UI
- reporting currency displayed in the UI
- requested/started/completed/failed timestamps displayed in the UI
- error code mapped to friendly failure copy

Important fields:

- `id`
- `user_id`
- `portfolio_id`
- `reporting_currency`
- `status`
- `payment_status`
- `error_code`
- `requested_at`
- `started_at`
- `completed_at`
- `failed_at`

Do not expose the following raw JSON blobs in Phase 4 UI:

- `canonical_snapshot`
- `analysis_output`
- `narrative_output`
- `error_details`

### `report_artifacts`

Phase 4 usage:

- used by `GET /api/v1/report-runs/:runId/pdf` to create signed PDF URLs
- should not be listed directly in the UI
- the UI should treat artifact access through the PDF endpoint only

### `portfolios`

Phase 4 usage:

- portfolio detail page is the starting point for report generation
- portfolio name/base currency should appear in report status and history UI where practical
- archived portfolios should not be eligible for new report creation
- old report runs for archived portfolios may still exist and should remain viewable if the run belongs to the user

## 8) API And Service Plan

### Existing API To Keep

- `POST /api/v1/report-runs`
- `GET /api/v1/report-runs/:runId`
- `GET /api/v1/report-runs/:runId/pdf`

These routes are already authenticated and ownership-scoped.

### API/Service Extension Needed

Phase 4 needs report history/listing, which does not currently exist.

Recommended addition:

- `GET /api/v1/report-runs`

Recommended query params:

- `portfolioId`, optional UUID filter
- `limit`, optional number with a safe max such as 50
- `status`, optional future filter; not required for the first implementation

Recommended response shape:

```json
{
  "reportRuns": [
    {
      "runId": "33333333-3333-4333-8333-333333333333",
      "portfolioId": "22222222-2222-4222-8222-222222222222",
      "portfolioName": "Retirement Portfolio",
      "status": "COMPLETED",
      "paymentStatus": "NOT_REQUIRED",
      "reportingCurrency": "CAD",
      "errorCode": null,
      "requestedAt": "2026-06-20T14:00:00.000Z",
      "startedAt": "2026-06-20T14:00:02.000Z",
      "completedAt": "2026-06-20T14:00:35.000Z",
      "failedAt": null
    }
  ]
}
```

Recommended service additions:

- `listReportRunsForUser(userId, options)`
- `listReportRunsForPortfolio(userId, portfolioId, options)` or one method with optional portfolio filter
- `findActiveReportRunForPortfolio(userId, portfolioId)` if duplicate active-run prevention is implemented through the app action

Recommended status response extension:

- Add `portfolioName` to `GET /api/v1/report-runs/:runId` if practical.
- This is additive and should not break existing API consumers.

Important response rules:

- Only return runs owned by the authenticated user.
- If `portfolioId` is provided and the portfolio is not owned by the user, return `404 PORTFOLIO_NOT_FOUND` to match the existing ownership-scoped API style.
- Do not expose raw provider errors, JSON pipeline payloads, or `error_details` to the browser.
- Keep the shared error envelope shape: `{ error: { code, message } }`.

## 9) UI Route Plan

Recommended routes:

- `/app/reports`
  - report history/list
- `/app/reports/[runId]`
  - report status and PDF access
- `/app/portfolios/[portfolioId]`
  - updated generate report panel and report history preview

Recommended components/actions:

- `GenerateReportForm` or `GenerateReportPanel`
- `generateReportFromPortfolio` server action
- `ReportStatusPanel` client component for polling
- `ReportStatusBadge`
- `ReportDownloadButton`
- `ReportRunList`
- `ReportFailureMessage`

Recommended app-shell changes:

- Add a live `Reports` navigation item once `/app/reports` exists.
- Keep `Portfolios` navigation unchanged.

## 10) UX Copy Guidelines

Use friendly status language:

- `Queued`: `Your report is in line to be generated.`
- `Processing`: `We are building your report now.`
- `Completed`: `Your report is ready.`
- `Failed`: `We could not finish this report.`

Avoid internal language:

- graphile-worker
- canonical snapshot
- narrative provider
- artifact storage
- orchestration failure
- queue job

Recommended failure message mapping:

- `CANONICAL_FAILURE` or `MARKET_DATA_OR_CANONICAL_FAILURE`:
  - `We could not prepare the market-data snapshot for this report. Check that the holdings use supported tickers and try again.`
- `ANALYSIS_FAILURE`:
  - `We could not complete the portfolio calculations for this report. Please try again.`
- `NARRATIVE_FAILURE`:
  - `We could not create the plain-English explanation for this report. Please try again.`
- `RENDER_FAILURE` or `PDF_FAILURE`:
  - `We completed the analysis, but could not prepare the PDF. Please try again.`
- `STORAGE_FAILURE`:
  - `We created the PDF, but could not save it for download. Please try again.`
- `ORCHESTRATION_FAILURE` or unknown:
  - `Something went wrong while generating this report. Please try again.`

Retry behavior:

- Retrying should create a new report run.
- Failed runs should remain visible in history.
- The UI should not mutate an old failed run back to queued.

## 11) Manual Outside-Code Work Required

No new Supabase dashboard configuration is expected for Phase 4.

Manual prerequisites for full local end-to-end validation:

1. Local `.env` has working Supabase values:
   - `DATABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_REPORTS_BUCKET`
2. Local `.env` has working graphile-worker values:
   - `GRAPHILE_WORKER_SCHEMA`
   - `GRAPHILE_WORKER_CONCURRENCY`
   - `GRAPHILE_WORKER_POLL_INTERVAL_MS`
   - `REPORT_RUN_TASK_IDENTIFIER`
3. Local `.env` has working narrative provider values:
   - `NARRATIVE_PROVIDER`
   - `NARRATIVE_PROVIDER_BASE_URL`
   - `NARRATIVE_PROVIDER_API_KEY`
   - `NARRATIVE_MODEL`
   - `NARRATIVE_PROVIDER_TIMEOUT_MS`
4. Local `.env` has working market-data adapter values:
   - `MARKET_DATA_SERVICE_URL=http://127.0.0.1:8000`
   - `MARKET_DATA_ADAPTER_INTERNAL_API_SECRET`
   - `MARKET_DATA_SERVICE_TIMEOUT_MS`
5. Supabase Storage bucket exists for report PDFs.
6. A signed-in test user exists.
7. A ready portfolio exists, or the user creates one through the Phase 3 UI.

Manual services to run for full local report generation:

```bash
npm run dev
```

```bash
npm run worker:dev
```

```bash
cd services/market-data-adapter
source .venv/bin/activate
export MARKET_DATA_ADAPTER_INTERNAL_API_SECRET="replace-with-long-random-secret"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Manual verification in Supabase after a successful run:

- `report_runs.status` transitions from `QUEUED` to `PROCESSING` to `COMPLETED`.
- `report_runs.user_id` equals the signed-in user ID.
- `report_runs.portfolio_id` equals the selected portfolio ID.
- `report_runs.reporting_currency` equals the UI-selected/default reporting currency.
- `report_artifacts` contains one `PDF_REPORT` row for the completed run.
- Supabase Storage contains `{userId}/{reportRunId}/report.pdf` in the configured bucket.

Manual work not required:

- no new Supabase Auth setup
- no new Google OAuth setup
- no new database schema migration expected
- no production worker host setup
- no production market-data provider setup
- no payment provider setup

Important production-readiness caveat:

- Full production report generation still requires a production-hosted worker and production-ready market-data service/provider. Phase 4 can fully validate the app UX locally, but Vercel-only testing will not complete reports unless the worker and market-data service are also running in reachable production infrastructure.

## 12) Implementation Stages

### Stage 0: Baseline And Current-State Audit

Goal:

- Confirm Phase 4 starts from the completed Phase 3 portfolio workspace and existing report pipeline APIs.

Tasks:

- Check working tree status.
- Read Phase 3 execution notes.
- Confirm portfolio detail still has the disabled placeholder action.
- Confirm report API routes are authenticated.
- Confirm `POST /api/v1/report-runs` still requires `portfolioId` and `reportingCurrency`.
- Confirm `GET /api/v1/report-runs/:runId` returns status metadata.
- Confirm `GET /api/v1/report-runs/:runId/pdf` returns signed URL metadata.
- Confirm no report-history API exists yet.

Verification:

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Python adapter tests if the adapter is touched during Phase 4

### Stage 1: Report-Run History Service And Contracts

Goal:

- Add the backend service support needed for report history and active-run detection.

Tasks:

- Extend report-run service/repository with list methods.
- Return only authenticated-user-owned runs.
- Support optional portfolio filtering.
- Return minimal safe metadata only.
- Join portfolio name where useful.
- Add active run helper for `QUEUED`/`PROCESSING` detection.
- Keep raw pipeline JSON out of response types.

Tests:

- list all user-owned runs
- list runs for one owned portfolio
- not-owned portfolio filtering does not leak runs
- active run helper finds queued/processing runs
- completed/failed runs do not count as active
- response does not expose internal JSON blobs or error details

### Stage 2: Report-Run API Extensions

Goal:

- Expose report history/listing through authenticated API routes.

Tasks:

- Add `GET /api/v1/report-runs`.
- Support optional `portfolioId` query param.
- Support a safe `limit` query param.
- Consider extending `GET /api/v1/report-runs/:runId` with `portfolioName`.
- Keep existing `POST`, status, and PDF routes backward-compatible.
- Preserve spoofed-header protection.

Tests:

- unauthenticated list request returns `401`
- valid list request returns user-owned runs
- portfolio filter scopes correctly
- invalid `portfolioId` returns `400`
- invalid `limit` returns `400`
- not-owned run is not returned
- status route remains owner-scoped
- PDF route remains owner-scoped

### Stage 3: Generate Report From Portfolio Detail

Goal:

- Replace the disabled placeholder with a real report-generation action for ready portfolios.

Tasks:

- Update `/app/portfolios/[portfolioId]` readiness panel.
- If not ready, keep the action disabled and explain that at least one holding is needed.
- If ready, render generate report form/action.
- Default reporting currency to portfolio base currency.
- Show compact `USD` / `CAD` report currency selector unless the user chooses default-only UX.
- Add server action that:
  - requires authenticated app user
  - validates portfolio ID and reporting currency
  - checks for an active report run for the portfolio
  - redirects to the active run if one exists
  - otherwise calls `ReportRunService.createAndEnqueue()`
  - redirects to `/app/reports/[runId]`
- Disable/dampen accidental double submit in the client/form UX where practical.
- Show friendly errors for validation, not-owned portfolio, and enqueue failure.

Tests:

- not-ready portfolio shows disabled action
- ready portfolio shows generate action
- default report currency equals portfolio base currency
- action uses authenticated user
- action redirects to new status page on success
- action redirects to existing active run when one exists
- action handles portfolio not found
- action preserves spoof-proof user ownership through service boundaries

### Stage 4: Report Status Page And Polling

Goal:

- Give the user a durable page that tracks the report run until completion or failure.

Tasks:

- Add `/app/reports/[runId]`.
- Server-load the initial status for the authenticated user.
- Add client polling component for in-progress states.
- Poll `GET /api/v1/report-runs/:runId` every 2-3 seconds while in progress.
- Stop polling on terminal states.
- Show requested/started/completed/failed timestamps when available.
- Link back to the source portfolio.
- Handle unauthorized/not-found by redirecting or showing a safe not-found state.
- Handle transient polling/network errors without losing the page.

Tests:

- queued status renders
- processing status renders
- completed status renders
- failed status renders
- polling stops on completed
- polling stops on failed
- polling continues for queued/processing
- not-found run is handled safely
- status page uses authenticated user

### Stage 5: PDF Open/Download Flow

Goal:

- Let the user access the generated PDF after completion.

Tasks:

- Add `ReportDownloadButton` or equivalent.
- Only show PDF action when status is `COMPLETED`.
- Fetch `GET /api/v1/report-runs/:runId/pdf` on click.
- Open signed URL in a new tab or trigger download.
- If signed URL generation fails, show a friendly retryable message.
- If artifact is not found, show `The PDF is not available yet. Try refreshing in a moment.`
- Do not store signed URL as durable report metadata.

Tests:

- completed run shows PDF action
- non-completed run does not show PDF action
- successful signed URL opens/downloads
- artifact-not-found error is user-friendly
- signed-url error is user-friendly
- unauthorized PDF request is handled by existing API behavior

### Stage 6: Report History/List UI

Goal:

- Give the user a place to find report runs after leaving the status page.

Tasks:

- Add `/app/reports`.
- Add `Reports` to app shell navigation.
- Load authenticated user's report runs.
- Show empty state when no reports exist.
- Show report rows/cards with:
  - portfolio name
  - status
  - reporting currency
  - requested date
  - completed/failed date where applicable
  - action to open status page
- Add portfolio filter support only if it stays simple.
- Add portfolio detail latest/history preview:
  - active run link when queued/processing
  - latest completed run link when available
  - short history list if useful

Tests:

- reports empty state renders
- reports list renders user-owned runs
- Reports navigation link is live
- report row links to status page
- portfolio detail shows active run link
- portfolio detail does not show another user's report runs

### Stage 7: Failure, Retry, And Long-Running State Polish

Goal:

- Make report failures understandable and recoverable without exposing internals.

Tasks:

- Map backend `errorCode` values to friendly copy.
- Add retry action for failed runs.
- Retry should create a new report run, not mutate the failed one.
- Preserve failed run in history.
- Add long-running queued/processing copy for runs taking longer than expected.
- If worker is not running in local dev, queued status should remain calm and understandable.

Tests:

- known error codes map to expected user messages
- unknown error code maps to generic message
- retry creates/redirects to a new run
- failed run remains visible in history
- long-running queued/processing copy renders after threshold if implemented

### Stage 8: Local End-To-End Report Generation Validation

Goal:

- Prove the UI can drive the full backend pipeline locally.

Manual setup:

- Start Next dev server.
- Start graphile worker.
- Start Python market-data adapter.
- Confirm narrative provider env is valid.
- Sign in through the app.
- Use or create a ready portfolio.

Manual flow:

1. Open portfolio detail.
2. Confirm `Ready for report` state.
3. Select/confirm report currency.
4. Click generate report.
5. Confirm redirect to `/app/reports/[runId]`.
6. Confirm status moves from queued to processing.
7. Confirm status moves to completed.
8. Open/download PDF.
9. Confirm report appears in `/app/reports`.
10. Confirm report appears in portfolio detail latest/history context.

Supabase verification:

- `report_runs` row has correct user, portfolio, reporting currency, and final status.
- `report_artifacts` row exists for completed run.
- Storage object exists at expected path.

Failure drill, if practical:

- Temporarily stop the worker and confirm queued state remains understandable.
- Temporarily stop market-data adapter and confirm failed state is user-friendly.
- Restore services after the drill.

### Stage 9: Full Verification And Quality Gate

Goal:

- Verify Phase 4 before signoff.

Automated verification:

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `services/market-data-adapter/.venv/bin/pytest services/market-data-adapter/tests`, if adapter code changed
- `npm run security:audit`, if dependencies changed
- `git diff --check`

Manual verification:

- signed-in ready portfolio happy path
- signed-in not-ready portfolio blocked path
- report status polling path
- completed PDF access path
- failed status display path, if practical
- report history path
- signed-out app route guard
- signed-out report API returns `401`
- cross-user/not-owned report status and PDF access return safe not-found behavior

### Stage 10: Documentation Updates

Goal:

- Preserve the head-office context for the next phase.

Documents to update:

- create `chatbotNotes/phase-4-report-generation-ui-execution.md`
- update `chatbotNotes/backend-knowledge-base.md` only if durable Q&A decisions are made
- update `chatbotNotes/manual-testing-steps.md` if a reusable Phase 4 manual QA runbook is created
- update `chatbotNotes/production-readiness.md` only if Phase 4 reveals a new production-only prerequisite

Do not overload Phase 1, Phase 2, or Phase 3 docs with Phase 4 implementation details.

## 13) Acceptance Criteria

Phase 4 is complete when:

1. Ready portfolio detail shows a real generate-report action.
2. Not-ready portfolio detail blocks report generation with clear copy.
3. Generate action defaults reporting currency to portfolio base currency.
4. Generate action creates a report run using the authenticated user session.
5. Generate action does not trust spoofed user IDs from client input.
6. Accidental duplicate active generation is prevented or redirected to the active run.
7. Successful generation redirects to `/app/reports/[runId]`.
8. Report status page renders queued state.
9. Report status page renders processing state.
10. Report status page renders completed state.
11. Report status page renders failed state with friendly copy.
12. Browser polling updates queued/processing runs and stops on terminal states.
13. Completed reports expose an open/download PDF action through the signed-URL endpoint.
14. Signed URL failures and missing artifacts show user-friendly messages.
15. `/app/reports` lists the signed-in user's report history.
16. Report history does not expose another user's runs.
17. Portfolio detail shows useful report context, such as active/latest report link.
18. App shell includes a live Reports navigation item.
19. Existing report APIs remain authenticated and ownership-scoped.
20. Full local happy path can generate and download at least one PDF when Next, worker, Python adapter, Supabase, and narrative provider are running.
21. Tests, typecheck, lint, build, and relevant Python tests pass.
22. Phase 4 execution notes record implementation, verification, manual caveats, and signoff status.

## 14) Suggested Implementation Order For The Next Chat

1. Read this document.
2. Read `chatbotNotes/phase-3-portfolio-management-mvp-execution.md`.
3. Inspect current report-run API routes and `ReportRunService`.
4. Inspect portfolio detail page where the disabled placeholder currently lives.
5. Run Stage 0 baseline checks.
6. Add report-run history/list service methods and tests.
7. Add `GET /api/v1/report-runs` and tests.
8. Add generate-report server action and portfolio detail UI changes.
9. Add `/app/reports/[runId]` status page and polling component.
10. Add completed PDF open/download behavior.
11. Add `/app/reports` history page and Reports navigation.
12. Add failure/retry polish.
13. Run automated verification.
14. Run local full E2E with worker, market-data adapter, and narrative provider.
15. Update Phase 4 execution notes.
16. Perform acceptance-criteria review.

## 15) Risks And Watchpoints

### Worker Not Running

Risk:

- A generated run can remain `QUEUED` indefinitely in local/dev if the worker is not running.

Mitigation:

- UI should calmly show queued state.
- Local E2E instructions must explicitly start `npm run worker:dev`.
- Do not treat a stuck queued run as a frontend bug until worker status is checked.

### Market-Data Adapter Not Running

Risk:

- The worker can fail during canonical/market-data stage if the Python adapter is unavailable.

Mitigation:

- Manual E2E instructions must start the adapter.
- Failed UI should map market-data/canonical errors to friendly copy.
- Keep raw provider errors out of the browser.

### Narrative Provider Latency Or Failure

Risk:

- Report generation can take tens of seconds or fail at the narrative stage.

Mitigation:

- Polling UI should set expectations that report generation can take a little time.
- Failure copy should be retryable and non-technical.
- Do not promise exact completion time.

### Duplicate Runs And Cost

Risk:

- Repeated clicks or refreshes can create multiple report runs for the same portfolio.

Mitigation:

- Disable submit while pending.
- Detect active queued/processing run and link to it.
- Consider stronger idempotency later if usage/cost risk increases.

### Signed URL Expiry

Risk:

- Supabase signed URLs expire after the configured TTL.

Mitigation:

- Request signed URLs on demand.
- If opening fails, let the user request a fresh link.

### Error Leakage

Risk:

- Backend error details can reveal internal provider, storage, or user identifiers.

Mitigation:

- UI maps `errorCode` to friendly copy.
- APIs keep generic public messages.
- Do not expose `error_details` in report history/status UI.

### Production Readiness Confusion

Risk:

- A Vercel endpoint can create report runs, but reports will not complete unless a production worker and market-data service are also running.

Mitigation:

- Keep production worker hosting and production market-data provider replacement in `production-readiness.md`.
- Phase 4 local E2E can be signed off with local worker/adapter.
- Do not claim full production readiness from Vercel API-only testing.

## 16) Next Phase Preview

Recommended Phase 5 depends on product priority after Phase 4 signoff.

Likely options:

1. Payment/checkout gate before report generation.
2. Production readiness hardening for worker and market-data provider.
3. Report library polish, saved report management, and email delivery.
4. User settings/account management.
5. Security hardening/RLS review before public beta.
