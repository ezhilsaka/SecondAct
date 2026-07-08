# Second Act Performance Audit - 2026-06-20

## Scope

Performance-only repo audit for the current Second Act worktree. Focus areas:

- Public landing/login first-load behavior.
- Authenticated app shell, portfolio list, portfolio detail, report library, and report status routes.
- Portfolio APIs and Prisma/Postgres query paths.
- Report-run queue, external provider calls, and PDF rendering.
- Fixes that should not change user-facing behavior.

## Current Performance Status

Overall status: Green for the audited code-level fixes after the 2026-06-21 re-audit.

The app has a strong baseline: most portfolio and report UI is server-rendered, heavy report generation is queued through Graphile Worker, external provider calls have timeout guards, report history reads are bounded, and Prisma queries generally select only needed columns. The homepage cacheability issue, protected-render auth/profile duplication, up-front saved-holding edit/remove form rendering, dashboard summary query shape, PDF render cost visibility, narrative retry latency visibility, and report-history requested-time query shape have now been addressed. No open code-level performance findings remain from this audit; the next work is operational monitoring before changing worker concurrency, PDF renderer lifecycle, report-status polling cadence, or provider strategy.

## 2026-06-21 Re-Audit After Phase 4/5 Changes

Baseline:

- Previous performance checkpoint: `cd35760b325665fac2adbc7161701a7555690cbe` (`PerformanceFixes-2`).
- Current audited head: `b02a7fd` (`Phase5-reporthistory-functionalmvp-Step7-8`).

Changed areas reviewed:

- Report generation/status/library UI under `src/app/app/reports`.
- Report-run API routes under `src/app/api/v1/report-runs`.
- Dashboard latest-report card in `src/app/app/page.tsx`.
- Portfolio detail report-history preview in `src/app/app/portfolios/[portfolioId]/page.tsx`.
- Report-run service list/status/download/delete methods in `src/server/services/report-run-service.ts`.
- Account/profile app-shell changes that affect protected app render paths.

Re-audit observations:

- Report library server render is bounded to `limit: 50`; portfolio detail preview is bounded to `limit: 3`; dashboard latest report is bounded to `limit: 1`.
- Dashboard report and portfolio summary loads run in parallel.
- Report download buttons fetch signed URLs only on click; completed rows do not create signed URLs during initial render.
- Report status polling is limited to `QUEUED` and `PROCESSING` statuses and stops after terminal status.
- The one new code-level finding was the report-history query/index mismatch fixed in item 8 below.

## Fixes Applied In This Pass

### 1. Public landing page is now static

Evidence:

- Before: `src/app/(marketing)/page.tsx` called `getAuthenticatedUser()` and exported `dynamic = "force-dynamic"`.
- After: landing CTAs point to `/app`; the existing proxy still redirects unauthenticated users to `/login?next=/app`.
- `npm run build` now reports `○ /`, confirming the homepage is prerendered static content.

Resolution:

- Removed the server auth lookup from the public homepage.
- Kept the final user journey equivalent: authenticated users reach `/app`; unauthenticated users are routed by proxy to login.

Files:

- `src/app/(marketing)/page.tsx`
- `src/app/(marketing)/page.test.tsx`

### 2. Active portfolio ordering now has a matching index

Evidence:

- `PortfolioService.listActivePortfolios()` filters by `userId` and `archivedAt: null`, then orders by `updatedAt desc`.
- Existing schema indexed `(user_id, archived_at)` but not the order column.

Resolution:

- Added `portfolios_user_id_archived_at_updated_at_desc_idx`.
- This supports active portfolio list/dashboard reads as portfolio counts grow.

Files:

- `src/db/prisma/schema.prisma`
- `src/db/prisma/migrations/20260620000000_add_portfolio_updated_at_index/migration.sql`

### 3. Protected app render paths now share one request-scoped auth/profile load

Evidence:

- Before: the protected app layout loaded auth/profile, then child pages called `requireAuthenticatedUser()` again for page data.
- Before: `bootstrapAuthenticatedUserProfile()` also called `ensureUserUsage()` when loading an existing profile, adding a write-style database operation to normal page navigation.
- After: `src/server/auth/app-session.ts` wraps auth/profile loading in React `cache()`, so app layout and child server components share the same request-scoped app session.
- After: existing profile loads no longer upsert `user_usage`; new profile creation still ensures usage rows, and report completion keeps its existing usage upsert repair path.

Resolution:

- Added a cached `loadAuthenticatedAppSession()` helper and `requireAuthenticatedAppUser()` wrapper.
- Updated protected app render pages to use the cached app-session helper.
- Kept server actions on direct `requireAuthenticatedUser()` calls because each mutation request should authenticate independently.
- Updated tests to prove the app-session helper performs one auth/profile load per request cache, and existing profile reads no longer write usage rows.

Files:

- `src/server/auth/app-session.ts`
- `src/server/auth/app-session.test.ts`
- `src/server/auth/profile-bootstrap.ts`
- `src/server/auth/profile-bootstrap.test.ts`
- `src/app/app/layout.tsx`
- `src/app/app/page.tsx`
- `src/app/app/portfolios/page.tsx`
- `src/app/app/portfolios/[portfolioId]/page.tsx`
- `src/app/app/portfolios/[portfolioId]/edit/page.tsx`

### 4. Saved holding edit/remove forms now mount lazily

Evidence:

- Before: each saved holding row rendered a full client `HoldingForm` and remove form inside closed `<details>` blocks.
- After: each saved holding row initially renders only Edit and Remove action toggles.
- After: the edit or remove form mounts only after the user opens that specific row action.

Resolution:

- Added a `HoldingRowActions` client component for saved holding row actions.
- Kept the server-rendered holdings table and the always-visible Add Holding form unchanged.
- Preserved the update/remove server actions and remove-form field contract (`portfolioId`, `holdingId`, `confirmRemove`).
- Added tests proving initial saved-row markup does not include `Save Holding`, `Remove Holding`, or `holdingId`, and that the mounted remove form still submits the same fields.

Files:

- `src/app/app/portfolios/[portfolioId]/HoldingRowActions.tsx`
- `src/app/app/portfolios/[portfolioId]/HoldingRowActions.test.tsx`
- `src/app/app/portfolios/[portfolioId]/page.tsx`
- `src/app/app/portfolios/[portfolioId]/page.test.tsx`
- `src/app/app/portfolios/[portfolioId]/page.module.css`

### 5. Dashboard summary no longer loads the full portfolio list

Evidence:

- Before: `src/app/app/page.tsx` called `PortfolioService.listPortfolios()` and only used the active portfolio count plus newest portfolio.
- After: the dashboard calls `PortfolioService.getDashboardSummary()`, which returns the same count/latest shape without materializing every active portfolio.
- The Prisma repository uses one transaction with `count` plus `findFirst` ordered by `updatedAt desc`.

Resolution:

- Added a dedicated dashboard summary service/repository method.
- Kept `listPortfolios()` unchanged for portfolio list/API screens.
- Updated dashboard tests to prove the page calls the summary path, and service tests to prove the summary path does not call `listActivePortfolios()`.

Files:

- `src/app/app/page.tsx`
- `src/app/app/page.test.tsx`
- `src/server/services/portfolio-service.ts`
- `src/server/services/portfolio-service.test.ts`

### 6. PDF render stage now emits cost metadata

Evidence:

- Before: stage logs captured render duration, but not renderer identity or output size.
- After: successful `pdf_render` stage logs include `pdfRenderer`, `pdfByteSize`, and `pdfMimeType` alongside existing duration metadata.

Resolution:

- Added PDF-only result metadata to the existing orchestrator stage-completed log.
- Kept the Playwright renderer lifecycle unchanged for MVP safety; per-report Chromium launch remains intentionally unchanged until worker concurrency or throughput requirements change.
- Updated orchestrator tests to prove PDF stage logs include renderer and byte-size metadata.

Files:

- `src/server/orchestrators/report-run-orchestrator.ts`
- `src/server/orchestrators/report-run-orchestrator.test.ts`

### 7. Narrative retry path now logs malformed-output latency

Evidence:

- Before: invalid structured output triggered one retry, but there was no first-attempt failure-rate or retry-latency signal.
- After: malformed first attempts log a warning with duration; retry recovery logs attempt/retry durations; retry failure logs attempt/retry durations and the contract error message.

Resolution:

- Added optional `logger` and `nowMs` dependencies to `OpenAICompatibleNarrativeProvider` for structured telemetry and deterministic tests.
- Preserved the same request payload, timeout behavior, retry count, and returned narrative output.
- Added tests for retry recovery telemetry and retry-failure telemetry.

Files:

- `src/server/providers/openai-compatible-narrative-provider.ts`
- `src/server/providers/openai-compatible-narrative-provider.test.ts`

### 8. Report history queries now have requested-time indexes

Evidence:

- Phase 4/5 added report-history surfaces that list report runs by `requestedAt desc`:
  - Dashboard latest report: `limit: 1`.
  - Portfolio detail report preview: `portfolioId`, `limit: 3`.
  - Report library: `limit: 50`, with optional portfolio/status/currency filters.
- Existing report-run indexes were on `createdAt`, while the new service queries order by `requestedAt`.

Resolution:

- Added a user-level requested-time index for dashboard and report-library reads.
- Added a user+portfolio requested-time index for portfolio-scoped report previews and report-library filters.
- Kept existing `createdAt` indexes in place for compatibility with the original schema.

Files:

- `src/db/prisma/schema.prisma`
- `src/db/prisma/migrations/20260621000000_add_report_run_requested_at_indexes/migration.sql`

## Completed Findings

### P1 - Protected routes repeat auth/profile work per request

Status: Fixed.

Completed by fix 3 above.

### P1 - Portfolio detail renders every edit form up front

Status: Fixed.

Completed by fix 4 above.

### P2 - Dashboard fetches the full portfolio list for summary UI

Status: Fixed.

Completed by fix 5 above.

### P2 - Worker PDF rendering launches Chromium per report

Status: Fixed for the current MVP operating model.

Completed by fix 6 above. The renderer still launches Chromium per report by design; the fix adds the missing cost telemetry needed before safely increasing concurrency or introducing browser reuse.

### P2 - Narrative provider can double latency on malformed output

Status: Fixed.

Completed by fix 7 above.

### P2 - Report history queries order by requested time without matching indexes

Status: Fixed.

Completed by fix 8 above.

## Remaining Findings And Resolutions

No open code-level performance findings remain from this audit.

Operational follow-ups:

- Monitor `pdf_render` duration and `pdfByteSize` before raising worker concurrency or changing the renderer lifecycle.
- Monitor `narrative_provider.first_attempt_invalid`, `narrative_provider.retry_recovered`, and `narrative_provider.retry_invalid` before deciding whether prompt/schema or provider changes are needed.
- Monitor report-status polling load as concurrent active report users grow; current polling is intentionally scoped to active report status pages only.

## Verification Completed

Commands run:

- `npm test -- --run 'src/app/(marketing)/page.test.tsx' src/components/landing/SecondActLanding.test.tsx`
- `npm test -- --run src/server/services/portfolio-service.test.ts src/app/api/v1/portfolios/route.test.ts`
- `npm test -- --run src/server/auth/app-session.test.ts src/server/auth/profile-bootstrap.test.ts src/server/auth/supabase-server.test.ts src/components/auth/ProfileCompletionForm.test.tsx src/app/app/page.test.tsx src/app/app/portfolios/page.test.tsx src/app/app/portfolios/[portfolioId]/page.test.tsx`
- `npm test -- --run src/server/auth/app-session.test.ts src/server/auth/profile-bootstrap.test.ts src/app/app/page.test.tsx src/app/app/portfolios/page.test.tsx src/app/app/portfolios/[portfolioId]/page.test.tsx`
- `npm test -- --run src/app/app/portfolios/[portfolioId]/HoldingRowActions.test.tsx src/app/app/portfolios/[portfolioId]/page.test.tsx src/components/portfolio/HoldingForm.test.tsx src/app/app/portfolios/actions.test.ts`
- `npm test -- --run src/app/app/page.test.tsx src/server/services/portfolio-service.test.ts src/server/orchestrators/report-run-orchestrator.test.ts src/server/providers/openai-compatible-narrative-provider.test.ts`
- `npm run typecheck`
- `npm run lint`
- `git diff --check`
- `npm run build`
- `npm run db:format`
- `npm test`
- `npm test -- --run src/server/services/report-run-service.test.ts src/app/api/v1/report-runs/route.test.ts src/app/api/v1/report-runs/[runId]/route.test.ts src/app/app/reports/page.test.tsx src/app/app/reports/[runId]/page.test.tsx src/app/app/reports/[runId]/ReportStatusPanel.test.tsx src/app/app/reports/[runId]/ReportDownloadButton.test.tsx src/app/app/reports/actions.test.ts src/app/app/page.test.tsx src/app/app/portfolios/[portfolioId]/page.test.tsx`
- `npm run db:format`
- `npm run typecheck`
- `npm run lint`
- `git diff --check`
- `npm run build`
- `npm test`

Results:

- Targeted landing tests: 2 files passed, 3 tests passed.
- Portfolio service/API tests: 2 files passed, 27 tests passed.
- Auth/profile dedupe focused tests: 6 files passed, 26 tests passed.
- Auth/profile dedupe post-format tests: 5 files passed, 22 tests passed.
- Lazy holding row action focused tests: 4 files passed, 20 tests passed.
- Dashboard/PDF/narrative focused tests: 4 files passed, 75 tests passed.
- Typecheck passed.
- Lint passed.
- Diff whitespace check passed.
- Build passed after final fixes and confirmed `○ /` static homepage.
- Full test suite passed before auth/profile dedupe: 56 files, 391 tests.
- Full test suite passed after auth/profile dedupe: 57 files, 394 tests.
- Full test suite passed after lazy holding row actions: 58 files, 396 tests.
- Full test suite passed after final audit fixes: 58 files, 397 tests.
- Note: one concurrent `npm test` + `npm run build` attempt hit a Prisma client generation race while build ran `prisma generate`; rerunning `npm test` after build completed passed cleanly.
- Phase 4/5 report-history focused tests: 10 files passed, 109 tests passed.
- Prisma schema format passed after adding report-run requested-time indexes.
- 2026-06-21 re-audit typecheck passed.
- 2026-06-21 re-audit lint passed.
- 2026-06-21 re-audit diff whitespace check passed.
- 2026-06-21 re-audit build passed and confirmed `/app/reports` and `/app/reports/[runId]` are dynamic routes.
- Full test suite passed after the 2026-06-21 re-audit: 65 files, 483 tests.
