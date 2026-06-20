# Security Audit: Repo Deep Dive

**Reviewed by:** Security Engineer persona  
**Date:** 2026-06-20  
**Scope:** Current Second Act worktree, with focus on Next.js App Router auth, API routes, server actions, Prisma data access, CSP/security headers, env parsing, and report artifact access.  
**Status:** Fixes applied for confirmed repo-evidence issues, including approved high-severity npm audit remediations. Low/moderate dependency advisories remain tracked separately where npm's force path would downgrade or break core tooling.

## Summary

The app already had strong foundations in the current worktree: request-level auth in `src/proxy.ts`, route-level API auth, server-side user identity sourcing, Supabase auth helpers, Zod validation, Prisma parameterization, untracked `.env`, and security headers/CSP. The audit found several concrete hardening gaps that could disclose sensitive metadata or weaken security controls. All confirmed code-level issues listed below were fixed with focused security-only changes, regression tests, and a non-force dependency audit fix for high-severity advisories.

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

Commands run after fixes:

- `npm test` - passed, 56 files / 393 tests
- `npm run typecheck` - passed
- `npm run lint` - passed
- `npm run build` - passed
- `npm run security:audit` - passed at `--audit-level=high` after approved non-force `npm audit fix`; latest rerun also passed and confirmed remaining advisories are low/moderate only
- `services/market-data-adapter/.venv/bin/pytest services/market-data-adapter/tests` - passed, 26 tests
- `git diff --check` - passed
