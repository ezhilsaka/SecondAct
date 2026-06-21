# Phase 5 Plan: Report History And Functional MVP Closeout

Last updated: 2026-06-21

## 1) Purpose

Phase 5 turns the current local app into a complete functional MVP that can be tested end to end before production-readiness and payment work begin.

North-star local flow after Phase 5:

```text
Landing page -> Auth -> App shell -> Account/profile -> Portfolio management -> Holdings -> Report generation -> Report status -> PDF download -> Report history/library -> Report management
```

The product should feel functionally whole in local development after this phase.
Production hosting, production market data, and payment/commercial gating stay out of Phase 5.

## 2) Source Context

Completed foundations:

- Landing page exists and routes users into the app/auth flow.
- Phase 1 backend report pipeline is complete through queued worker processing, analysis, narrative, PDF rendering, artifact storage, and report-run status.
- Phase 2 auth/app shell is complete with protected workspace access, profile bootstrap, app navigation, and logout.
- Phase 3 portfolio management MVP is complete with authenticated portfolios, holdings, readiness states, ticker search, and ownership-safe APIs.
- Phase 4 report-generation UI is complete with ready-portfolio report generation, status polling, PDF access, basic report history, failure/retry states, and local E2E validation.
- PDF quality fixes are complete.

Current Phase 4 report-history state:

- `/app/reports` lists the signed-in user's latest report runs.
- Rows show portfolio name, status, reporting currency, requested time, completed/failed time, source portfolio link, and status-page link.
- `/app/reports/<runId>` shows status, polling, completed PDF access, and failed-run retry.
- Portfolio detail pages show a short recent-report preview.

Current gaps for a functional local MVP:

- Report history is a basic list, not yet a polished report library.
- Completed reports cannot be opened directly from the history list.
- Users cannot delete old completed/failed report runs or clean up their stored PDFs.
- Active, failed, and completed reports do not yet have a complete management experience from the report detail page.
- Account page still says the profile foundation exists but does not show real profile details or allow basic profile updates.
- Dashboard does not yet summarize the latest report/library state.
- Manual testing docs do not yet include one final Phase 5 full-product local E2E checklist.

## 3) Phase 5 Goal

Build the final local functional product layer.

After Phase 5, a user should be able to:

1. Sign in locally.
2. Complete or view their profile.
3. Create and manage manual portfolios.
4. Add, edit, and remove holdings.
5. Understand whether a portfolio is ready for report generation.
6. Generate a report from a ready portfolio.
7. Leave and return while a report is queued or processing.
8. Open a completed PDF report.
9. Find prior reports from a report library.
10. Filter report history enough to handle normal local usage.
11. Delete terminal reports they no longer need.
12. Confirm deleted completed reports remove both app metadata and stored PDF artifacts.
13. Re-run a report for the same portfolio when they want a fresh report.
14. Test the whole product locally without needing production worker hosting, production market data, or payment.

## 4) Non-Goals

Do not pull these into Phase 5:

- Payment, checkout, subscriptions, report credits, pricing, or commercial gates.
- Production worker hosting.
- Production market-data provider migration.
- Vercel-only full report-generation signoff.
- Public-beta security/RLS hardening beyond changes required by Phase 5 code.
- Broker import.
- CSV import.
- Email delivery of reports.
- Public report sharing links.
- Team/multi-user workspace collaboration.
- Full account deletion.
- Analytics, tracking, or marketing-cookie systems.
- Report content redesign or PDF quality work unless a Phase 5 UI change accidentally regresses PDF access.

These are not being skipped because they are unimportant. They are deferred because they are not required for the local functional MVP loop:

- Email delivery is a convenience/notification layer. Local users can already access reports through the private app library and signed PDF download flow.
- Public sharing links introduce access-control and expiry rules that should be designed after the private report library is solid.
- Broker and CSV import expand data-ingestion scope. Phase 5 remains manual-portfolio complete.
- Payment depends on the product being functionally complete first, so it belongs after local MVP signoff.
- Production hosting and provider migration belong to the production-readiness phase because local E2E still depends on local worker/adapter processes.

## 5) Recommended Product Decisions

These are the recommended defaults for implementation.

### Report Deletion

Use hard deletion for terminal reports in Phase 5.

Rules:

- Only the owner can delete a report.
- Only terminal runs can be deleted:
  - `COMPLETED`
  - `FAILED`
- Active runs cannot be deleted:
  - `QUEUED`
  - `PROCESSING`
  - `DRAFT`
  - `AWAITING_PAYMENT`
- Deleting a completed report must also remove its Supabase Storage PDF object.
- Deleting a failed report removes the report-run row and any artifact metadata if present.
- If storage deletion fails, do not delete the database row. Show a friendly retryable error.
- If storage metadata exists but the object is already missing, treat object cleanup as successful and continue deleting the database row. Log the missing-object condition for debugging.

Why:

- This gives the user a real way to manage old reports.
- It avoids keeping private PDFs after the user believes a report is deleted.
- It avoids adding soft-delete/archive schema complexity before production.

### Report Filtering

Keep filters useful but not overbuilt.

Recommended Phase 5 filters:

- status:
  - all
  - active
  - completed
  - failed
- reporting currency:
  - all
  - CAD
  - USD
- portfolio:
  - optional existing `portfolioId` query support

Do not add advanced date-range search, full-text search, or infinite pagination in Phase 5 unless local testing proves the library is hard to use without them.

### Report Re-Run

Add a clear "Generate fresh report" action from completed report detail and completed report rows.

Rules:

- Re-run creates a new report run for the same portfolio and reporting currency.
- Existing active-run detection remains in place, so duplicate active runs redirect to the active report instead of creating another run.
- Failed-run retry keeps the current behavior and should still preserve the failed run as the retry source only if the backend needs it later.

### Account/Profile

Make the account page useful but modest.

Recommended Phase 5 account scope:

- Show current profile:
  - first name
  - last name
  - email
  - investor handle
  - created/updated timestamps if available
- Allow editing first name and last name.
- Keep email read-only because it is owned by Supabase Auth.
- Keep investor handle read-only in Phase 5 to avoid uniqueness and profile-link complexity.
- Keep billing/payment controls out of scope.
- Keep full account deletion out of scope.

## 6) Data And API Plan

### Report List

Extend current report-list behavior rather than replacing it.

Existing endpoint:

```text
GET /api/v1/report-runs
```

Current supported query:

- `portfolioId`
- `limit`

Recommended additions:

- `status`
  - `ACTIVE`
  - `COMPLETED`
  - `FAILED`
  - optionally exact internal statuses if needed later
- `reportingCurrency`
  - `CAD`
  - `USD`

Response should remain a safe summary only.

Do not expose:

- `canonicalSnapshot`
- `analysisOutput`
- `narrativeOutput`
- `errorDetails`
- storage bucket internals beyond existing PDF signed-url route behavior

### Report Deletion

Add a dedicated owner-scoped delete path.

Recommended endpoint:

```text
DELETE /api/v1/report-runs/:runId
```

Recommended service method:

```text
deleteTerminalReportRunForUser(runId, userId)
```

Important implementation rule:

- Do not reuse the current repository `deleteReportRun(runId)` directly for user-facing deletion because it is unscoped and currently exists for enqueue-failure cleanup.
- Add owner-scoped repository methods for user-facing deletion.

Recommended backend sequence for a completed run:

1. Validate `runId`.
2. Load the run by `runId` and `userId`.
3. Return `404` if not found or not owned.
4. Reject non-terminal statuses with `409 REPORT_RUN_NOT_TERMINAL`.
5. If a PDF artifact exists, delete the storage object first.
6. If storage deletion succeeds or the object is already absent, delete the report-run row.
7. Rely on database cascade or explicit repository cleanup for artifact metadata.
8. Return `204 No Content`.
9. Revalidate `/app/reports`, `/app/reports/<runId>`, and the source portfolio detail path from server actions.

Recommended backend sequence for a failed run:

1. Validate ownership.
2. Confirm status is terminal.
3. Delete the report-run row.
4. Return `204 No Content`.

### PDF Access

Keep existing signed URL behavior:

```text
GET /api/v1/report-runs/:runId/pdf
```

Phase 5 should reuse this endpoint from history-row actions instead of embedding signed URLs into the report-list response.

### Profile Update

Recommended path:

```text
PATCH /api/v1/account/profile
```

or a server action scoped to `/app/account`.

Recommendation:

- Prefer a server action first because account editing is only needed from the app UI right now.
- Keep API expansion for profile management optional unless another client needs it.

Profile update rules:

- User must be authenticated.
- Only first name and last name are editable.
- Names must be trimmed and non-empty.
- Email remains read-only.
- Investor handle remains read-only.
- Response/UI must not expose auth tokens or raw Supabase errors.

## 7) UI Plan

### Report Library Page

Route:

```text
/app/reports
```

Target behavior:

- Page title should communicate that this is the user's report library, not just a technical run list.
- Show summary counts:
  - active reports
  - completed reports
  - failed reports
- Add filter controls:
  - status
  - currency
  - portfolio filter when arriving from a portfolio detail page
- Preserve filter state in URL search params.
- Show useful empty states for:
  - no reports at all
  - no reports matching current filters
- For each report row/card:
  - portfolio name
  - status badge
  - reporting currency
  - requested date
  - completed/failed date
  - source portfolio link
  - report detail/status link
  - direct `Open PDF` action for completed reports
  - `Generate fresh report` action for completed reports
  - `Retry report` action for failed reports
  - `Delete report` action for completed/failed reports
- Active rows should make it obvious that deletion is unavailable while the worker may still be processing.

### Report Detail Page

Route:

```text
/app/reports/<runId>
```

Target behavior:

- Use clearer copy for completed reports:
  - "Report details" instead of only "Track this report"
  - show that the report is ready and can be revisited later
- Keep polling for active reports.
- Keep friendly failure copy.
- Completed report actions:
  - open PDF
  - generate fresh report
  - delete report
  - back to Reports
  - back to source portfolio
- Failed report actions:
  - retry report
  - delete failed report
  - back to Reports
  - back to source portfolio
- Active report actions:
  - back to Reports
  - back to source portfolio
  - no delete action

### Portfolio Detail Report Preview

Route:

```text
/app/portfolios/<portfolioId>
```

Target behavior:

- Keep the existing recent-report preview.
- Add a "View all reports for this portfolio" link that opens `/app/reports?portfolioId=<id>`.
- Completed preview rows can open the PDF or report detail.
- Failed preview rows can point to retry/delete from the report detail page.

### Dashboard

Route:

```text
/app
```

Target behavior:

- Keep the portfolio summary.
- Add a lightweight latest-report summary if reports exist:
  - latest report portfolio
  - status
  - requested/completed date
  - link to Reports
- If no reports exist, show a calm next step that points users to ready portfolios.

### Account Page

Route:

```text
/app/account
```

Target behavior:

- Replace placeholder profile-foundation copy.
- Show real app profile details.
- Add a small edit-name form.
- Show save success/error states.
- Keep billing/payment messaging out of the page until Phase 7.

## 8) Manual Supabase / External Setup

Expected manual setup for Phase 5:

- No new Supabase project feature is expected.
- No new storage bucket is expected.
- No new provider account is expected.
- No payment provider setup.
- No production worker hosting.
- No production market-data provider setup.

Possible database work:

- Report hard deletion can likely use the existing schema because `ReportArtifact` cascades from `ReportRun`.
- Profile editing can use the existing `user_profiles` fields.
- If implementation chooses soft-delete/archive for reports instead of hard deletion, a migration would be required. This plan recommends hard deletion to avoid that migration in Phase 5.

Manual Supabase checks during testing:

- Confirm deleted completed report rows are gone from `public.report_runs`.
- Confirm related `public.report_artifacts` rows are gone.
- Confirm the PDF object is gone from the private reports bucket.
- Confirm other users' report rows and artifacts are untouched.
- Confirm profile name edits update only the signed-in user's `public.user_profiles` row.

## 9) Implementation Stages

### Stage 0: Baseline Audit

Goals:

- Confirm clean working tree.
- Re-read Phase 4 closeout.
- Inspect current report history, report detail, account, dashboard, and service code.
- Confirm no production/payment scope is pulled into Phase 5.

Deliverables:

- Short execution-note entry when implementation starts.
- Any phase-specific questions resolved before coding.

### Stage 1: Report Management Service Contract

Goals:

- Add safe report-list filters in the service/repository layer.
- Add terminal report deletion service behavior.
- Add storage cleanup dependency for report deletion.
- Keep deletion owner-scoped.

Tests:

- list filters by status/currency/portfolio.
- rejects invalid list filters.
- delete completed report deletes storage before DB metadata.
- delete failed report deletes DB metadata without requiring a PDF.
- rejects deletion for active runs.
- returns not-found for cross-user report deletion.
- storage deletion failure preserves DB metadata and surfaces a friendly error class.
- missing storage object with existing metadata is treated as cleanup success.

### Stage 2: Report API And Server Actions

Goals:

- Extend `GET /api/v1/report-runs` query validation for Phase 5 filters.
- Add `DELETE /api/v1/report-runs/:runId`.
- Add server actions for:
  - delete report from library/detail
  - generate fresh report from completed report
  - retry failed report remains intact
- Revalidate affected app routes.

Tests:

- unauthenticated delete returns `401`.
- invalid run id returns `400`.
- cross-user delete returns `404`.
- active run delete returns `409`.
- completed/failed owner delete returns `204`.
- delete action redirects or refreshes with friendly status.
- list filters remain safe and do not expose raw pipeline JSON.

### Stage 3: Report Library UI

Goals:

- Upgrade `/app/reports` from basic history to report library.
- Add summary counts and filters.
- Add direct completed-report actions.
- Add delete confirmation for terminal runs.
- Add empty states for no results and no reports.

Tests:

- empty report library renders next step.
- filter controls preserve selected search params.
- completed rows show Open PDF, Generate fresh report, and Delete.
- failed rows show Retry and Delete.
- active rows do not show Delete.
- no raw pipeline details are rendered.

### Stage 4: Report Detail UI

Goals:

- Polish completed and failed report detail states.
- Add "Back to Reports".
- Add completed re-run and delete actions.
- Add failed delete action.
- Keep active polling behavior unchanged.

Tests:

- completed detail shows PDF, re-run, delete, and navigation actions.
- failed detail shows retry, delete, and navigation actions.
- active detail keeps polling and hides delete.
- long-running active copy remains intact.

### Stage 5: Portfolio Preview And Dashboard Polish

Goals:

- Add portfolio-specific report-library link from portfolio detail.
- Add latest-report summary to dashboard.
- Ensure dashboard copy reflects the product's current local functional state after Phase 5.

Tests:

- portfolio detail links to `/app/reports?portfolioId=<id>`.
- latest report summary renders when reports exist.
- dashboard still handles no-portfolios and no-reports states.

### Stage 6: Account/Profile Polish

Goals:

- Replace the account placeholder with real profile information.
- Add first/last name editing.
- Keep email and handle read-only.
- Keep payment/billing out of account page.

Tests:

- account page renders profile details.
- successful name update persists and shows success copy.
- blank names are rejected with friendly errors.
- signed-out users are redirected by existing app guard.
- payment/billing controls are not rendered in Phase 5.

### Stage 7: Full Local E2E Runbook And Documentation

Goals:

- Update `chatbotNotes/manual-testing-steps.md` with a Phase 5 checklist.
- Add a Phase 5 execution note while work progresses.
- Update `backend-knowledge-base.md` only if durable behavior decisions need to be captured.

Manual local E2E checklist should cover:

1. Landing CTA to login.
2. Google or email OTP auth.
3. Profile view/edit.
4. Portfolio create/edit/archive.
5. Holding add/edit/remove.
6. Report generation from ready portfolio.
7. Status polling.
8. PDF open/download.
9. Report library filters.
10. Completed report re-run.
11. Failed report retry if a failure drill is run.
12. Completed report delete with storage cleanup.
13. Failed report delete.
14. Cross-user report-library and delete protection.
15. Signed-out API checks.

### Stage 8: Full Verification And Closeout

Goals:

- Run automated test suite.
- Run typecheck, lint, and build.
- Run Python market-data tests if pipeline-adjacent code changed.
- Run security audit only if dependency manifests changed.
- Run `git diff --check`.
- Complete requirement-by-requirement closeout against this plan.

Recommended verification:

```bash
npm test
npm run typecheck
npm run lint
npm run build
services/market-data-adapter/.venv/bin/pytest services/market-data-adapter/tests
git diff --check
```

If no Python or dependency files changed, document why Python tests or security audit were skipped.

## 10) Acceptance Criteria

Phase 5 is complete only when all of the following are true:

1. `/app/reports` works as a report library, not just a static history list.
2. Report library supports status and currency filtering.
3. Report library can be scoped to a source portfolio.
4. Completed reports can be opened directly from the library.
5. Completed reports can start a fresh report for the same portfolio/currency.
6. Failed reports can still be retried.
7. Completed and failed reports can be deleted by their owner.
8. Active reports cannot be deleted.
9. Completed-report deletion removes the private storage PDF object and report metadata.
10. Storage deletion failure does not silently remove DB metadata.
11. Cross-user report listing, detail, PDF, and deletion remain protected.
12. Report list/status/delete responses do not expose raw pipeline JSON or provider details.
13. Report detail page has complete actions for active, completed, and failed states.
14. Portfolio detail page links to the portfolio-scoped report library.
15. Dashboard gives a clear path into reports and portfolios after Phase 5.
16. Account page shows real profile data.
17. Account page allows first/last name updates.
18. Account page keeps email, investor handle, payment, and billing controls out of scope.
19. Manual Phase 5 local E2E runbook exists.
20. Automated tests cover new service, API/action, and UI behavior.
21. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check` pass unless a documented environment blocker exists.
22. No Phase 5 implementation requires production worker hosting.
23. No Phase 5 implementation requires production market-data provider migration.
24. No Phase 5 implementation requires payment setup.
25. No stale UI/documentation copy claims report generation, report history, or profile management is still future work after Phase 5 closeout.

## 11) Risks And Watchpoints

### Storage Cleanup Ordering

Risk:

- Deleting DB metadata before storage cleanup can orphan private PDFs.

Mitigation:

- Delete storage first for completed reports.
- Delete DB metadata only after storage cleanup succeeds or the object is confirmed already absent.

### Unscoped Delete Helpers

Risk:

- Existing enqueue-cleanup deletion is unscoped and should not become user-facing deletion.

Mitigation:

- Add explicit owner-scoped delete methods for Phase 5.
- Keep tests for cross-user deletion.

### Active Run Deletion

Risk:

- Deleting queued/processing rows can confuse worker state or leave jobs processing missing data.

Mitigation:

- Reject active-run deletion in Phase 5.
- Let active runs finish or fail, then allow terminal deletion.

### Report Library Overbuilding

Risk:

- Search, pagination, and advanced filters can expand beyond the local MVP goal.

Mitigation:

- Implement status/currency/portfolio filters first.
- Keep advanced search/date-range pagination for a later scaling phase.

### Account Scope Creep

Risk:

- Account work can slide into billing, account deletion, or identity-provider management.

Mitigation:

- Phase 5 account scope is profile display and first/last name editing only.

### Production Readiness Drift

Risk:

- Local E2E success can be mistaken for production readiness.

Mitigation:

- Keep `production-readiness.md` as the source for production worker, market-data, model, auth branding, secret, and repository-hygiene work.
- Phase 5 signoff should explicitly say local functional MVP, not production-ready launch.

## 12) Suggested Implementation Order

Recommended order:

1. Create `chatbotNotes/phase-5-report-history-functional-mvp-execution.md`.
2. Implement report service/repository filters and owner-scoped deletion.
3. Implement report API delete and list-filter extensions.
4. Implement report server actions.
5. Upgrade report library UI.
6. Upgrade report detail actions/copy.
7. Add portfolio preview and dashboard links/summaries.
8. Implement account profile display/edit.
9. Update manual testing runbook.
10. Run full automated and manual verification.
11. Complete a requirement-by-requirement closeout in the Phase 5 execution note.

## 13) Phase 6 And Phase 7 Handoff

Do not start these until Phase 5 is tested and signed off.

Phase 6 should focus on production readiness:

- production worker runtime for Graphile Worker
- production-ready market-data provider or hosted adapter
- model readiness and latency/quality review
- production environment variables and secret handling
- auth branding/custom domain
- RLS/security review
- operational monitoring and logs
- release hygiene for internal notes

Phase 7 should focus on payment/commercial flow:

- checkout/payment provider
- payment gate before report generation
- `AWAITING_PAYMENT` path activation
- payment webhooks
- report entitlement/credits
- billing/account UI
- payment failure/refund states

## 14) Final Stop Point For Phase 5

Stop after:

- the full local functional product loop is implemented,
- automated verification passes,
- manual local E2E is completed,
- report deletion/storage cleanup is verified,
- account/profile local behavior is verified,
- Phase 5 execution notes are closed out,
- and the user confirms Phase 5 is ready to hand off to production-readiness planning.
