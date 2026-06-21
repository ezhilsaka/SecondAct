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
- Stage 3 report library UI: complete
- Stage 4 report detail UI: complete
- Stage 5 portfolio preview and dashboard polish: complete
- Stage 6 account/profile polish: complete
- Stage 7 full local E2E runbook and documentation: pending
- Stage 8 full verification and closeout: pending

Current stop point requested by user:

- Implement Stage 5 and Stage 6 only.
- Stop after Stage 6 verification and before Stage 7 full local E2E runbook/documentation.

UX clarification status:

- No UX question blocks Stages 5-6.
- The plan already defines the relevant Stage 5-6 behavior:
  - portfolio detail keeps recent reports and links to the portfolio-scoped report library
  - dashboard keeps portfolio summary and adds latest-report summary/no-report next step
  - account page shows real profile data
  - first and last name are editable
  - email and investor handle stay read-only
  - payment, billing, and full account deletion stay out of scope
- Stage 6 preserves the plan's modest account scope:
  - profile update is a server action, not a new public API surface
  - names are trimmed and must be non-empty
  - browser-facing failures stay friendly and generic

Prior Stage 3-4 UX behavior:

  - report library summary counts and filters
  - completed report library actions for PDF open, fresh report generation, and deletion
  - failed report library actions for retry and deletion
  - no delete action for active reports
  - report detail navigation back to Reports and source portfolio
  - completed and failed report detail management actions
- Stage 3 required a small query-state clarification:
  - `status` is now reserved for report-library filtering
  - successful delete feedback uses `notice=report_deleted`
  - delete failures continue to use `error=<friendly-code>`

Prior Stage 1-2 UX behavior:

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
  friendly `notice` or `error` query state.
- Delete success uses `notice=report_deleted` so report-library `status` filters can remain in
  the URL after deleting from a filtered view.
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

## 7) Stage 3: Report Library UI

Status: complete on 2026-06-21.

Implemented:

- Upgraded `/app/reports` from basic report history to report library.
- Added owner-scoped summary counts for:
  - active reports
  - completed reports
  - failed reports
- Added URL-backed filters for:
  - `status=ACTIVE|COMPLETED|FAILED`
  - `reportingCurrency=CAD|USD`
  - existing `portfolioId` scoping
- Preserved selected filters in library links, form submissions, and delete return paths.
- Added friendly action feedback:
  - `notice=report_deleted`
  - `error=<friendly-delete-error-code>`
- Added completed-row actions:
  - report details
  - direct `Open PDF`
  - `Generate fresh report`
  - `Delete report`
- Added failed-row actions:
  - report details
  - `Retry report`
  - `Delete report`
- Kept active-row management locked until the run finishes.
- Added empty states for:
  - no reports yet
  - no matching reports for selected filters
- Kept report-list rendering limited to safe summary fields.

Files changed:

- `src/app/app/reports/page.tsx`
- `src/app/app/reports/page.module.css`
- `src/app/app/reports/page.test.tsx`
- `src/app/app/reports/ReportFormSubmitButton.tsx`
- `src/app/app/reports/[runId]/ReportDownloadButton.tsx`
- `src/app/app/reports/actions.ts`
- `src/app/app/reports/actions.test.ts`

Behavior notes:

- The report library remains a Server Component page. Filters are parsed from `searchParams` and
  passed to `ReportRunService.listReportRunsForUser`.
- Summary counts are derived from the current portfolio scope when `portfolioId` is present.
- Status/currency filters trigger a second list call so counts remain scoped but unfiltered by the
  selected status/currency.
- Invalid portfolio query values are ignored by the page parser; valid but not-owned portfolio IDs
  are handled through the existing owner-scoped service check and render `notFound()`.
- Completed-row PDF open still uses the existing signed-url route on demand instead of embedding
  signed URLs in the report-list response.
- Delete confirmation is handled by a small client submit button while the form action remains the
  Stage 2 server action.
- `status` is no longer used for delete success feedback because it is the report-library filter
  query param. Delete success now uses `notice=report_deleted`.

Focused tests added/updated:

- empty report library renders the next step
- summary counts render
- filter controls preserve selected `status`, `reportingCurrency`, and `portfolioId`
- completed rows show Open PDF, Generate fresh report, and Delete
- failed rows show Retry and Delete
- active rows hide terminal management actions
- filtered empty state renders when reports exist but none match
- raw pipeline/storage/internal details are not rendered
- report page passes URL filters to `ReportRunService`
- portfolio-scoped library returns not found when the portfolio cannot be accessed
- delete action preserves filters and uses `notice=report_deleted`

Verification:

- `npm test -- --run src/app/app/reports/page.test.tsx src/app/app/reports/[runId]/page.test.tsx src/app/app/reports/[runId]/ReportStatusPanel.test.tsx src/app/app/reports/[runId]/ReportDownloadButton.test.tsx src/app/app/reports/actions.test.ts`: passed, 44 tests across 5 files.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- Full `npm test`: passed, 473 tests across 63 files.
- `git diff --check`: passed.

## 8) Stage 4: Report Detail UI

Status: complete on 2026-06-21.

Implemented:

- Polished `/app/reports/[runId]` page copy by report state:
  - completed reports now use "Report details" framing
  - failed reports now use recovery-oriented copy
  - active reports keep the status-tracking copy
- Added `Back to Reports` navigation.
- Kept `Back to Portfolio` navigation.
- Added completed detail actions:
  - open PDF
  - generate fresh report
  - delete report
- Added failed detail actions:
  - retry report
  - delete failed report
- Kept active polling behavior unchanged.
- Kept long-running active report copy unchanged.
- Kept delete action hidden for active reports.

Files changed:

- `src/app/app/reports/[runId]/page.tsx`
- `src/app/app/reports/[runId]/page.module.css`
- `src/app/app/reports/[runId]/page.test.tsx`
- `src/app/app/reports/[runId]/ReportStatusPanel.tsx`
- `src/app/app/reports/[runId]/ReportStatusPanel.test.tsx`
- `src/app/app/reports/ReportFormSubmitButton.tsx`

Behavior notes:

- Completed-report fresh generation and failed-report retry both use
  `generateReportFromPortfolio`; existing active-run detection continues to prevent duplicate
  active reports.
- Completed and failed detail delete actions use `deleteReportRunFromForm` and return to
  `/app/reports`.
- Active statuses continue polling exactly as Phase 4 designed; the Stage 4 changes only add
  terminal-state actions and navigation.

Focused tests added/updated:

- completed detail shows PDF, re-run, delete, and navigation actions
- failed detail shows retry, delete, and navigation actions
- active detail keeps polling and hides delete/fresh-run/retry actions
- long-running active copy remains covered

Verification:

- `npm test -- --run src/app/app/reports/page.test.tsx src/app/app/reports/[runId]/page.test.tsx src/app/app/reports/[runId]/ReportStatusPanel.test.tsx src/app/app/reports/[runId]/ReportDownloadButton.test.tsx src/app/app/reports/actions.test.ts`: passed, 44 tests across 5 files.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- Full `npm test`: passed, 473 tests across 63 files.
- `git diff --check`: passed.

## 9) Stage 5: Portfolio Preview And Dashboard Polish

Status: complete on 2026-06-21.

Implemented:

- Kept the existing portfolio-detail recent-report preview.
- Added a portfolio-scoped report-library link from portfolio detail:
  - `/app/reports?portfolioId=<portfolioId>`
- Added completed preview-row actions:
  - report detail
  - direct `Open PDF`
- Added failed preview-row routing to the report detail page for retry/delete management.
- Added a dashboard latest-report summary when reports exist:
  - portfolio name
  - report status
  - reporting currency
  - requested/completed/failed date
  - report detail link
  - Reports library link
- Added a dashboard no-report state that points users toward portfolios.

Files changed:

- `src/app/app/portfolios/[portfolioId]/page.tsx`
- `src/app/app/portfolios/[portfolioId]/page.module.css`
- `src/app/app/portfolios/[portfolioId]/page.test.tsx`
- `src/app/app/page.tsx`
- `src/app/app/page.module.css`
- `src/app/app/page.test.tsx`

Behavior notes:

- Portfolio detail still fetches the latest three report runs for the portfolio.
- Completed preview-row PDF access reuses the existing signed-url flow through
  `ReportDownloadButton`.
- Failed preview rows route to `/app/reports/[runId]`, where Stage 4 retry/delete actions live.
- Dashboard latest-report data uses `ReportRunService.listReportRunsForUser(user.id, { limit: 1 })`.
- No production worker, production market-data, or payment behavior was added.

Focused tests added/updated:

- portfolio detail links to `/app/reports?portfolioId=<id>`
- completed portfolio preview rows show report detail and Open PDF actions
- failed portfolio preview rows point to report detail management
- dashboard latest-report summary renders when reports exist
- dashboard no-report state renders when no reports exist
- dashboard still handles no-portfolio state

Verification:

- `npm test -- --run src/server/auth/profile-bootstrap.test.ts src/app/app/account/page.test.tsx src/app/app/account/actions.test.ts src/app/app/page.test.tsx src/app/app/portfolios/[portfolioId]/page.test.tsx src/app/app/reports/[runId]/ReportDownloadButton.test.tsx`: passed, 34 tests across 6 files.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- Full `npm test`: passed, 483 tests across 65 files.
- `git diff --check`: passed.

## 10) Stage 6: Account/Profile Polish

Status: complete on 2026-06-21.

Implemented:

- Replaced `/app/account` placeholder copy with real profile details.
- Displayed:
  - first name
  - last name
  - email
  - investor handle
  - created timestamp
  - updated timestamp
- Added first/last-name edit form.
- Added `updateProfileNameFromForm` server action.
- Added `updateAuthenticatedUserProfile` service behavior.
- Kept email and investor handle read-only.
- Kept payment, billing, and account deletion out of the account page.
- Added friendly save success/error states:
  - `notice=profile_updated`
  - `error=profile_validation_error`
  - `error=profile_update_failed`

Files changed:

- `src/server/auth/profile-bootstrap.ts`
- `src/server/auth/profile-bootstrap.test.ts`
- `src/app/app/account/actions.ts`
- `src/app/app/account/actions.test.ts`
- `src/app/app/account/page.tsx`
- `src/app/app/account/page.module.css`
- `src/app/app/account/page.test.tsx`

Behavior notes:

- Profile updates are owner-scoped by the authenticated Supabase user.
- Only `firstName` and `lastName` are updated.
- Submitted names are trimmed and must be non-empty.
- The profile update path does not update email or investor handle.
- The account page relies on the existing app layout/session guard for signed-out redirects.
- Raw auth/database failures are mapped to friendly account-page errors.

Focused tests added/updated:

- account page renders profile details
- account page renders profile save success and validation error states
- account page does not render payment, billing, or account-deletion controls
- profile service updates only first and last name
- profile service rejects blank names
- account action persists valid name edits and revalidates app/account paths
- account action rejects blank names before authenticated update
- account action maps validation and unexpected failures to friendly errors

Verification:

- `npm test -- --run src/server/auth/profile-bootstrap.test.ts src/app/app/account/page.test.tsx src/app/app/account/actions.test.ts src/app/app/page.test.tsx src/app/app/portfolios/[portfolioId]/page.test.tsx src/app/app/reports/[runId]/ReportDownloadButton.test.tsx`: passed, 34 tests across 6 files.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- Full `npm test`: passed, 483 tests across 65 files.
- `git diff --check`: passed.

## 11) Current Stop Point

Stop requested by user:

- Complete Stage 5 and Stage 6 only.
- Stop before Stage 7 full local E2E runbook/documentation.

Current stop point status:

- Stage 0 baseline audit is complete.
- Stage 1 report management service contract is complete.
- Stage 2 report API and server actions are complete.
- Stage 3 report library UI is complete.
- Stage 4 report detail UI is complete.
- Stage 5 portfolio preview/dashboard polish is complete.
- Stage 6 account/profile polish is complete.
- No Stage 7 manual runbook work has been started.
- No production worker, production market-data, or payment scope was added.

Verification at this stop point:

- `npm test -- --run src/server/auth/profile-bootstrap.test.ts src/app/app/account/page.test.tsx src/app/app/account/actions.test.ts src/app/app/page.test.tsx src/app/app/portfolios/[portfolioId]/page.test.tsx src/app/app/reports/[runId]/ReportDownloadButton.test.tsx`: passed, 34 tests across 6 files.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm test`: passed, 483 tests across 65 files.
- `git diff --check`: passed.

Next planned step after user review:

- Stage 7: Full Local E2E Runbook And Documentation.
