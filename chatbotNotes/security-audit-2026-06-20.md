# Security Audit: Repo Deep Dive

- **Reviewed by:** Security Engineer persona
- **Latest audit date:** 2026-06-21
- **Audit checkpoint commit:** `b02a7fd35e2473a493c20a3ee04e8452c333edec` (`Phase5-reporthistory-functionalmvp-Step7-8`, committed 2026-06-21 17:29:21 -04:00)
- **Previous audit checkpoint:** `cd35760b325665fac2adbc7161701a7555690cbe` (`PerformanceFixes-2`, committed 2026-06-20 17:27:51 -04:00)
- **Uncommitted worktree addendum:** Also reviewed the current uncommitted report-run `requestedAt` index migration/schema changes present on 2026-06-21.
- **Scope:** Current Second Act worktree, with focus on Next.js App Router auth, API routes, server actions, Prisma data access, CSP/security headers, env parsing, and report artifact access.
- **Status:** Security audit completed through the checkpoint commit above. The 2026-06-21 incremental review of changes since the previous checkpoint found no new confirmed code-level security findings. The only pending items remain: moderate/low dependency advisories not force-fixed, and app-side rate limiting for pre-public launch.

## Summary

The app already had strong foundations in the current worktree: request-level auth in `src/proxy.ts`, route-level API auth, server-side user identity sourcing, Supabase auth helpers, Zod validation, Prisma parameterization, untracked `.env`, and security headers/CSP. The original audit found several concrete hardening gaps that could disclose sensitive metadata or weaken security controls. All confirmed code-level issues listed below were fixed with focused security-only changes, regression tests, and a non-force dependency audit fix for high-severity advisories.

The 2026-06-21 incremental audit reviewed the changes from `cd35760b325665fac2adbc7161701a7555690cbe` through `b02a7fd35e2473a493c20a3ee04e8452c333edec`, including the report generation UI, report history/status pages, account profile update flow, report-run API extensions, and report-run service changes. It also reviewed the current uncommitted report-run `requestedAt` index migration/schema addendum. No new confirmed code-level security finding was identified. Future security audit work should start from code added after the current checkpoint commit plus the reviewed uncommitted index addendum, while carrying forward only the two pending items listed in `Remaining Recommendations`.

## Remediation Workflow

Handle the remaining audit items one at a time in the sequence below. After each fix, update this audit document before moving to the next item: record the status change, the exact resolution, files changed, functional-impact notes, and the verification commands/results for that fix.

1. Moderate/low dependency advisories not force-fixed - resolve through planned Next/Prisma/tooling upgrades or approved targeted overrides; do not use `npm audit fix --force` without a separate compatibility plan.
2. App-side rate limiting for pre-public launch - add product-approved limits for auth, report creation, and market-data search while preserving normal user workflows.

No other audit findings are pending from this security review.

## Incremental Audit - 2026-06-21

**Reviewed range:** `cd35760b325665fac2adbc7161701a7555690cbe..b02a7fd35e2473a493c20a3ee04e8452c333edec`

**Changed areas reviewed:**

- Report-run API list/status/delete extensions under `src/app/api/v1/report-runs`
- Report generation, report library, report status, PDF download, retry, and delete server-action flows under `src/app/app/reports`
- Portfolio detail/dashboard report integrations under `src/app/app/portfolios/[portfolioId]` and `src/app/app`
- Account profile update flow under `src/app/app/account`
- Profile bootstrap/update logic under `src/server/auth/profile-bootstrap.ts`
- Report-run ownership, list, artifact, signed URL, and deletion logic under `src/server/services/report-run-service.ts`
- Uncommitted report-run `requestedAt` index additions in `src/db/prisma/schema.prisma` and `src/db/prisma/migrations/20260621000000_add_report_run_requested_at_indexes/migration.sql`

**Result:** No new confirmed code-level security finding. The reviewed code continues to source user identity server-side, validates UUID/currency/status inputs, scopes report-run reads/deletes/downloads by authenticated user, returns generic client-facing errors for cross-user/not-found cases, sanitizes report delete return paths to same-app report-library paths, and uses fixed notice/error codes instead of reflecting free-form user input into redirects. The uncommitted DB addendum adds non-unique report-run indexes only; it does not change row visibility, access control, data mutation behavior, or secret handling.

**Functional-impact note:** This incremental security audit did not change product code. The only file changed by this security-audit pass is this audit document; the separate uncommitted Prisma/performance-audit changes were reviewed for security impact as current worktree state.

## Fixed Findings

### A01: Broken Access Control - mutation filters relied on pre-checks

**Risk:** Medium  
**Evidence:** `PortfolioService` verified ownership before update/delete, but the actual Prisma mutations used record IDs alone.  
**Resolution:** Portfolio and holding mutations now include `userId`, `portfolioId`, and active-state filters at the Prisma mutation boundary where applicable. Existing service-level ownership checks remain in place for defense in depth.  
**Files:** `src/server/services/portfolio-service.ts`, `src/server/services/portfolio-service.test.ts`

### A02/A05: Sensitive details in API error responses

**Risk:** Medium  
**Evidence:** Report-run and portfolio API routes returned service exception messages that could include user IDs, run IDs, portfolio IDs, or report status details.  
**Resolution:** Client-facing API error messages are now generic for not-found, archived, and artifact-unavailable cases. Report-run service exception text was also made generic so future handlers are less likely to leak identifiers.  
**Files:** `src/app/api/v1/report-runs/**`, `src/app/api/v1/portfolios/route-helpers.ts`, `src/server/services/report-run-service.ts`

### A02: Portfolio form values leaked into URLs

**Risk:** Medium  
**Evidence:** Portfolio server actions redirected validation/save failures with `name`, `baseCurrency`, and `description` in the query string, and form pages read those values back from `searchParams`. Portfolio descriptions can contain sensitive financial context and URLs are exposed through history, logs, and referrers.  
**Resolution:** Redirects now carry only error codes. Create/edit pages no longer hydrate portfolio form defaults from URL query values; edit pages use current server-loaded portfolio data.  
**Files:** `src/app/app/portfolios/actions.ts`, `src/app/app/portfolios/new/page.tsx`, `src/app/app/portfolios/[portfolioId]/edit/page.tsx`

### A07: Logout supported mutating GET requests

**Risk:** Low  
**Evidence:** `/auth/logout` signed out on both GET and POST. A top-level cross-site GET can trigger logout with SameSite=Lax cookies, causing forced sign-out.  
**Resolution:** GET now returns `405 Method Not Allowed` with `Allow: POST`; the existing app shell already uses a POST form for sign-out.  
**Files:** `src/app/auth/logout/route.ts`, `src/app/auth/logout/route.test.ts`

### A04/A05: Boolean env parsing misread `"false"` as `true`

**Risk:** Medium  
**Evidence:** `PAYMENT_GATE_ENABLED` used `z.coerce.boolean()`. In the installed Zod version, `z.coerce.boolean().parse("false")` returns `true`, contradicting tests/docs and making feature flags unsafe.  
**Resolution:** Added explicit boolean-string parsing for `"true"` and `"false"`, with regression coverage for both values.  
**Files:** `src/server/config/schema.ts`, `src/server/config/schema.test.ts`

### A05: CSP hardening gap

**Risk:** Low  
**Evidence:** CSP had a nonce-based `script-src` and strict framing controls but did not explicitly block legacy object/plugin execution.  
**Resolution:** Added `object-src 'none'` and regression coverage.  
**Files:** `src/lib/security/content-security-policy.ts`, `src/lib/security/content-security-policy.test.ts`

### A10: PDF renderer allowed browser network access

**Risk:** Medium  
**Evidence:** The Playwright PDF renderer used `page.setContent()` against generated report HTML. The current report HTML escapes dynamic content and does not intentionally load remote resources, but the browser context did not explicitly block network requests. A future report-template change or missed escaping path could allow report content to trigger outbound requests during PDF rendering.  
**Resolution:** The PDF browser context now aborts all network requests before rendering. Report output remains fully inline.  
**Files:** `src/server/renderers/playwright-pdf-renderer.ts`, `src/server/renderers/playwright-pdf-renderer.test.ts`

### A03/A10: Market-data adapter ticker boundary was looser than app boundary

**Risk:** Low  
**Evidence:** The Python adapter normalized and de-duplicated ticker input, but did not enforce the web app's ticker character and length constraints before calling the provider. Current app-created holdings already validate tickers, but this adapter is an internal boundary and should fail closed if a future caller sends malformed symbols.  
**Resolution:** The adapter now rejects tickers that contain characters outside letters, numbers, dots, and hyphens, or exceed 15 characters.  
**Files:** `services/market-data-adapter/app/models.py`, `services/market-data-adapter/tests/test_main.py`, `services/market-data-adapter/tests/test_quote_service.py`

### A06: High-severity dependency advisories

**Risk:** High  
**Evidence:** After npm registry access was approved, `npm run security:audit` initially reported high-severity advisories in Hono and Vite dependency paths, plus a lower-severity Babel arbitrary-file-read advisory.  
**Resolution:** Ran `npm audit fix` without `--force`, which updated only `package-lock.json`. Confirmed patched resolved versions include `next@16.2.9`, `vite@8.0.16`, `hono@4.12.26`, `@babel/core@7.29.7`, `js-yaml@4.2.0`, and `brace-expansion@5.0.6`. `npm run security:audit` now exits successfully at the project's high-severity audit threshold.  
**Files:** `package-lock.json`

## Remaining Recommendations

### Moderate/low dependency advisories not force-fixed

**Status:** Tracked follow-up  
**Evidence:** After the non-force fix, `npm run security:audit` exits successfully for the configured `--audit-level=high` gate. The latest approved rerun still reports 1 low and 5 moderate advisories in `@hono/node-server` through Prisma tooling, `esbuild`, and `postcss` through Next. npm's force remedies would install breaking/downgrade versions such as `next@9.3.3` and `prisma@6.19.3`, so they were intentionally not applied.  
**Resolution:** Track these through planned Next/Prisma/tooling upgrades or an approved targeted override. Do not apply `npm audit fix --force` without a separate compatibility plan.

### App-side rate limiting for pre-public launch

**Status:** Recommended follow-up  
**Evidence:** No app-side limiter was found in `src`; project docs already track rate limiting/WAF/CAPTCHA as a pre-public-launch security task. Supabase/provider controls cover part of auth abuse, but authenticated report creation and market-data search remain app-level abuse surfaces.  
**Resolution:** Add product-approved limits for `/login`, `/auth/*`, `/api/v1/report-runs`, and `/api/v1/securities/search`, preferably at the edge/WAF plus per-user server-side enforcement for costly report generation.

## Verification

Latest incremental verification run for `cd35760b325665fac2adbc7161701a7555690cbe..b02a7fd35e2473a493c20a3ee04e8452c333edec`:

- `git diff --check cd35760b325665fac2adbc7161701a7555690cbe..HEAD` - passed
- `npm run security:audit` - passed at `--audit-level=high`; remaining advisories are still 1 low / 5 moderate in the tracked dependency follow-up bucket
- `npm run db:format` - passed for the current Prisma schema
- `npm test` - passed, 65 files / 483 tests, including a rerun after the uncommitted DB index addendum was detected
- `npm run typecheck` - passed
- `npm run lint` - passed
- `npm run build` - passed, including a rerun after the uncommitted DB index addendum was detected

Prior fix verification:

- `npm test` - passed, 56 files / 393 tests
- `npm run typecheck` - passed
- `npm run lint` - passed
- `npm run build` - passed
- `npm run security:audit` - passed at `--audit-level=high` after approved non-force `npm audit fix`; latest rerun also passed and confirmed remaining advisories are low/moderate only
- `services/market-data-adapter/.venv/bin/pytest services/market-data-adapter/tests` - passed, 26 tests
- `git diff --check` - passed
