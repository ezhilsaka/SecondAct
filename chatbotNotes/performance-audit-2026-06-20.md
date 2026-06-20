# Second Act Performance Audit - 2026-06-20

## Scope

Performance-only repo audit for the current Second Act worktree. Focus areas:

- Public landing/login first-load behavior.
- Authenticated app shell, portfolio list, and portfolio detail routes.
- Portfolio APIs and Prisma/Postgres query paths.
- Report-run queue, external provider calls, and PDF rendering.
- Fixes that should not change user-facing behavior.

## Current Performance Status

Overall status: Yellow.

The app has a strong baseline: most portfolio UI is server-rendered, heavy report generation is queued through Graphile Worker, external provider calls have timeout guards, and Prisma queries generally select only needed columns. The homepage cacheability issue and protected-render auth/profile duplication have now been addressed. The main remaining risks are growth behavior for holdings-heavy portfolios, dashboard summary query shape, and worker throughput for PDF generation.

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

## Completed Findings

### P1 - Protected routes repeat auth/profile work per request

Status: Fixed.

Completed by fix 3 above.

## Remaining Findings And Resolutions

### P1 - Portfolio detail renders every edit form up front

Evidence:

- `src/app/app/portfolios/[portfolioId]/page.tsx` maps every holding and renders a client `HoldingForm` inside each row's edit `<details>`.

Why it matters:

- Initial HTML/React payload and hydration work grow linearly with holding count.
- A 100-holding portfolio would ship 100 hidden edit forms plus 100 remove forms before the user edits anything.

Recommended resolution:

- Keep the server-rendered holdings table.
- Move row actions into a small client component that mounts the edit/remove form only when the matching action is opened.
- Preserve server actions, validation, and existing URLs; add tests that forms still submit with the same field names.

### P2 - Dashboard fetches the full portfolio list for summary UI

Evidence:

- `src/app/app/page.tsx` calls `PortfolioService.listPortfolios()` and only uses count plus latest portfolio.

Why it matters:

- Dashboard cost grows with total portfolio count even though it only needs aggregate plus one latest row.

Recommended resolution:

- Add a dedicated dashboard summary repository method using a transaction: `count` active portfolios plus `findFirst` latest active portfolio.
- Keep `listPortfolios()` for the portfolio list/API.

### P2 - Worker PDF rendering launches Chromium per report

Evidence:

- `src/server/renderers/playwright-pdf-renderer.ts` calls `chromium.launch()` inside each render.

Why it matters:

- Fine at low volume, but expensive for throughput and cold starts.

Recommended resolution:

- Keep this for MVP traffic if worker concurrency is 1.
- Before increasing worker concurrency, either reuse a browser per worker process with robust cleanup or cap concurrency to match CPU/memory budget.
- Add render duration and PDF byte-size metrics to the existing stage logs.

### P2 - Narrative provider can double latency on malformed output

Evidence:

- `OpenAICompatibleNarrativeProvider.generateNarrative()` retries once after invalid JSON.
- Default provider timeout is 30 seconds, so a malformed first attempt can consume roughly two timeout windows.

Why it matters:

- This is off the user-facing request path, but it affects report completion latency and worker occupancy.

Recommended resolution:

- Track first-attempt failure rate in logs/metrics.
- If common, tighten prompts/schema or move to a provider/API mode with stricter structured output.

## Verification Completed

Commands run:

- `npm test -- --run 'src/app/(marketing)/page.test.tsx' src/components/landing/SecondActLanding.test.tsx`
- `npm test -- --run src/server/services/portfolio-service.test.ts src/app/api/v1/portfolios/route.test.ts`
- `npm test -- --run src/server/auth/app-session.test.ts src/server/auth/profile-bootstrap.test.ts src/server/auth/supabase-server.test.ts src/components/auth/ProfileCompletionForm.test.tsx src/app/app/page.test.tsx src/app/app/portfolios/page.test.tsx src/app/app/portfolios/[portfolioId]/page.test.tsx`
- `npm test -- --run src/server/auth/app-session.test.ts src/server/auth/profile-bootstrap.test.ts src/app/app/page.test.tsx src/app/app/portfolios/page.test.tsx src/app/app/portfolios/[portfolioId]/page.test.tsx`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run db:format`
- `npm test`

Results:

- Targeted landing tests: 2 files passed, 3 tests passed.
- Portfolio service/API tests: 2 files passed, 27 tests passed.
- Auth/profile dedupe focused tests: 6 files passed, 26 tests passed.
- Auth/profile dedupe post-format tests: 5 files passed, 22 tests passed.
- Typecheck passed.
- Lint passed.
- Build passed and confirmed `○ /` static homepage.
- Full test suite passed before auth/profile dedupe: 56 files, 391 tests.
- Full test suite passed after auth/profile dedupe: 57 files, 394 tests.
