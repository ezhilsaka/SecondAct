# Phase 5 Report History Functional MVP Execution

Last updated: 2026-06-21

## 1) Purpose

This file is the execution companion to `phase-5-report-history-functional-mvp-plan.md`.

The plan defines the intended Phase 5 product shape. This file records what was implemented,
what was verified, and what remains as each stage is completed.

Phase 5 goal:

`Report library -> report management -> dashboard/account polish -> full local functional MVP closeout`

## 2) Working Rules For Phase 5

- Follow the implementation stages in `phase-5-report-history-functional-mvp-plan.md`.
- Stop at the user-requested stage boundary before continuing.
- Keep Phase 5 focused on the local functional MVP.
- Do not pull payment, production worker hosting, production market-data provider migration,
  broker import, CSV import, email delivery, public report sharing, team collaboration,
  full account deletion, analytics, or report-content redesign into this phase.
- Preserve Phase 2 authenticated-session boundaries and ownership-safe APIs.
- Keep raw pipeline JSON, provider payloads, storage internals, and raw provider errors out of
  browser/API responses.
- Add focused tests for every implementation stage.
- Update this execution file as work progresses.
- Update `chatbotNotes/backend-knowledge-base.md` only when a durable functionality or UX
  clarification needs to be preserved beyond the plan and execution evidence.

## 3) Current Phase Status

Current status:

- Stage 0 baseline audit: complete
- Stage 1 report management service contract: complete
- Stage 2 report API and server actions: complete
- Stage 3 report library UI: pending
- Stage 4 report detail UI: pending
- Stage 5 portfolio preview and dashboard polish: pending
- Stage 6 account/profile polish: pending
- Stage 7 full local E2E runbook and documentation: pending
- Stage 8 full verification and closeout: pending

Current stop point requested by user:

- Implement Stage 0, Stage 1, and Stage 2.
- Stop after Stage 2 verification and provide a summary for review.

UX clarification status:

- No UX question blocks Stages 0-2.
- The plan already defines the relevant Stage 1-2 behavior:
  - hard deletion for owner-owned terminal reports only
  - no deletion for active runs
  - storage cleanup before database deletion for completed reports
  - status/currency/portfolio report-list filters
  - friendly retryable failure handling when storage cleanup fails
  - delete server actions that revalidate affected app routes

## 4) Stage 0: Baseline Audit

Status: complete on 2026-06-21.

Goals:

- Confirm current worktree state.
- Re-read the Phase 5 plan.
- Re-read the Phase 4 closeout.
- Inspect current report history, report detail, account, dashboard, and service code.
- Confirm no production/payment scope is pulled into Phase 5.

Findings:

- `chatbotNotes/phase-5-report-history-functional-mvp-plan.md` is currently untracked and is
  treated as the user-provided Phase 5 plan artifact.
- No other worktree changes were present at Stage 0 start.
- Phase 4 closeout confirms report generation, status polling, PDF access, basic history,
  failure/retry states, and local E2E validation are complete.
- Current `/app/reports` is a basic authenticated report history list.
- Current `/app/reports/[runId]` supports status polling, completed PDF access, and failed retry.
- Current portfolio detail shows a recent-report preview.
- Current dashboard says report generation is live but does not summarize latest reports.
- Current account page still shows placeholder profile-foundation copy.
- Current `ReportRunService` has an unscoped `deleteReportRun(runId)` repository helper used only
  for enqueue-failure cleanup; Phase 5 user-facing deletion needs a separate owner-scoped path.
- Existing Prisma schema supports Phase 5 hard deletion without a migration because
  `ReportArtifact` cascades from `ReportRun`.

Scope decision:

- Stages 0-2 will not add report-library UI, report-detail UI polish, dashboard polish, account
  editing, manual runbook updates, production hosting, market-data migration, or payment work.

## 5) Stage 1: Report Management Service Contract

Status: complete on 2026-06-21.

Implemented:

- Extend report-list options with safe `status` and `reportingCurrency` filters.
  - `status=ACTIVE` maps to active worker-facing states (`QUEUED`, `PROCESSING`).
  - `status=COMPLETED` and `status=FAILED` map to exact terminal report states.
  - `reportingCurrency` supports `CAD` and `USD`.
- Keep the report-list response to safe summary fields only.
- Add owner-scoped terminal report deletion service behavior.
- Add an injectable storage deletion dependency.
- Delete completed-report storage before deleting the database row.
- Reject active/non-terminal report deletion.
- Preserve database metadata if storage cleanup fails.
- Treat already-missing storage objects as cleanup success and continue deletion.

Files changed:

- `src/server/services/report-run-service.ts`
- `src/server/services/report-run-service.test.ts`

Behavior notes:

- The existing unscoped `deleteReportRun(runId)` repository helper remains only for enqueue-failure
  cleanup.
- User-facing deletion uses `deleteTerminalReportRunForUser(runId, userId)` and owner-scoped
  repository deletion.
- Completed report deletion checks for a PDF artifact and deletes the storage object first.
- Failed report deletion does not require a PDF artifact.
- Active or otherwise non-terminal runs are rejected with `ReportRunNotTerminalError`.
- Storage cleanup failures throw `ReportStorageDeleteError` before metadata deletion, preserving the
  report row for retry.
- Missing storage objects with existing metadata are logged and treated as cleanup success.

Focused tests added/updated:

- list filters by status, currency, and portfolio
- invalid status/currency filters
- completed report storage deletion before database metadata deletion
- failed report deletion without requiring a PDF
- active report deletion rejection
- cross-user/not-owned delete as not found
- storage deletion failure preserving database metadata
- already-missing storage object treated as cleanup success

Verification:

- `npm test -- --run src/server/services/report-run-service.test.ts src/app/api/v1/report-runs/route.test.ts src/app/api/v1/report-runs/[runId]/route.test.ts src/app/app/reports/actions.test.ts`: passed, 67 tests across 4 files.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- Full `npm test`: initially failed because Prisma Client was stale/missing `.prisma/client/default`;
  `npm run build` regenerated Prisma Client, then `npm test` passed with 463 tests across 63 files.

## 6) Stage 2: Report API And Server Actions

Status: complete on 2026-06-21.

Implemented:

- Extend `GET /api/v1/report-runs` query validation for `status` and `reportingCurrency`.
- Add `DELETE /api/v1/report-runs/:runId`.
- Add `deleteReportRunFromForm` for library/detail usage.
- Keep `generateReportFromPortfolio` as the shared fresh-report/retry action.
- Revalidate `/app/reports`, `/app/reports/[runId]`, and source portfolio detail paths after
  successful deletion.

Files changed:

- `src/app/api/v1/report-runs/route.ts`
- `src/app/api/v1/report-runs/route.test.ts`
- `src/app/api/v1/report-runs/[runId]/route.ts`
- `src/app/api/v1/report-runs/[runId]/route.test.ts`
- `src/app/app/reports/actions.ts`
- `src/app/app/reports/actions.test.ts`

API behavior:

- `GET /api/v1/report-runs` now accepts:
  - `portfolioId`
  - `limit`
  - `status=ACTIVE|COMPLETED|FAILED`
  - `reportingCurrency=CAD|USD`
- Invalid filters return `400 VALIDATION_ERROR`.
- `DELETE /api/v1/report-runs/:runId`:
  - returns `401 UNAUTHORIZED` when signed out
  - returns `400 INVALID_RUN_ID` for invalid UUIDs
  - returns `404 REPORT_RUN_NOT_FOUND` for missing/not-owned runs
  - returns `409 REPORT_RUN_NOT_TERMINAL` for active/non-terminal runs
  - returns `502 REPORT_STORAGE_DELETE_FAILED` when storage cleanup fails before metadata deletion
  - returns `204 No Content` after owner-scoped completed/failed deletion succeeds

Server action behavior:

- `deleteReportRunFromForm` validates `runId`, authenticates the user, calls the owner-scoped
  delete service, revalidates affected app paths, and redirects back to `/app/reports` with
  friendly `status` or `error` query state.
- Delete return paths are limited to `/app/reports` and `/app/reports?...` so form input cannot
  redirect away from the report library.
- `generateReportFromPortfolio` remains the shared action for both completed-report fresh reruns
  and failed-report retry; no Stage 2 change was needed there.

Focused tests added/updated:

- API list filters pass safe values to the service
- invalid API list filters return validation errors
- delete API auth, invalid UUID, not-found, active-run conflict, storage-failure, and success cases
- delete action success revalidates report library, status page, and source portfolio detail
- delete action validation, return-path sanitization, not-found, active-run, and storage-failure redirects

Verification:

- `npm test -- --run src/server/services/report-run-service.test.ts src/app/api/v1/report-runs/route.test.ts src/app/api/v1/report-runs/[runId]/route.test.ts src/app/app/reports/actions.test.ts`: passed, 67 tests across 4 files.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- Full `npm test`: initially failed because Prisma Client was stale/missing `.prisma/client/default`;
  `npm run build` regenerated Prisma Client, then `npm test` passed with 463 tests across 63 files.

## 7) Current Stop Point

Stop requested by user:

- Complete Stage 0, Stage 1, and Stage 2, then stop for review before Stage 3.

Current stop point status:

- Stage 0 baseline audit is complete.
- Stage 1 report management service contract is complete.
- Stage 2 report API and server actions are complete.
- No report-library UI changes have been started.
- No report-detail UI polish has been started.
- No portfolio preview/dashboard polish has been started.
- No account/profile polish has been started.
- No production worker, production market-data, or payment scope was added.

Verification at this stop point:

- `npm test -- --run src/server/services/report-run-service.test.ts src/app/api/v1/report-runs/route.test.ts src/app/api/v1/report-runs/[runId]/route.test.ts src/app/app/reports/actions.test.ts`: passed, 67 tests across 4 files.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm test`: passed, 463 tests across 63 files after `npm run build` regenerated stale Prisma Client output.
- `git diff --check`: passed.

Next planned step after user review:

- Stage 3: Report Library UI.
