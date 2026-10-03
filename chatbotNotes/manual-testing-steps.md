# Manual Testing Steps

Last updated: 2026-06-21

Purpose:

- Provide one browser-ready manual testing checklist for Phase 2 auth/app-shell behavior, Phase 3 portfolio management, Phase 4 report-generation UI, and Phase 5 report-library/profile MVP closeout.
- Keep this document focused on local manual validation. Automated test evidence remains in the phase execution notes.
- Treat Phase 4 and Phase 5 as the local functional UI/interaction layers on top of the existing report pipeline. This checklist does not replace the automated test suite or the phase execution notes.

## 1) Local Setup

### 1.1 Start Next.js

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

### 1.2 Start Market-Data Adapter For Ticker Search And Reports

Run this if you want ticker autocomplete to return real local results or if you are testing Phase 4/5 report generation.

```bash
cd services/market-data-adapter
source .venv/bin/activate
export MARKET_DATA_ADAPTER_INTERNAL_API_SECRET="<same value as .env>"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Confirm the Next.js app has:

```text
MARKET_DATA_SERVICE_URL=http://127.0.0.1:8000
MARKET_DATA_ADAPTER_INTERNAL_API_SECRET=<same value used by the adapter>
```

Health check:

```bash
curl -i http://127.0.0.1:8000/health
```

Expected:

- status `200`
- body includes `status: ok`
- body includes provider `yfinance`

### 1.3 Start Graphile Worker For Report Generation

Run this in a separate terminal for Phase 4/5 report generation:

```bash
npm run worker:dev
```

Expected:

- worker starts without env validation errors
- log says it is connected and looking for jobs
- task name includes `report.run.generate`

### 1.4 Confirm Phase 4/5 Report Env

Before running Phase 4/5 report-generation and report-management checks, confirm the local environment has valid values for:

```text
DATABASE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_REPORTS_BUCKET
REPORT_RUN_TASK_IDENTIFIER
MARKET_DATA_SERVICE_URL
MARKET_DATA_ADAPTER_INTERNAL_API_SECRET
NARRATIVE_PROVIDER
NARRATIVE_PROVIDER_BASE_URL
NARRATIVE_PROVIDER_API_KEY
NARRATIVE_MODEL
```

Expected:

- narrative provider credentials are valid
- Supabase report bucket exists
- report bucket is private
- local market-data adapter URL matches `MARKET_DATA_SERVICE_URL`
- do not paste or commit secret values into this file

### 1.5 Browser Setup

Use either:

- one normal browser session for signed-in tests
- one incognito/private session for signed-out tests

Keep DevTools Console open during the main browser flows.

Expected:

- no CSP errors
- no hydration errors
- no uncaught runtime errors

## 2) Phase 2 Manual Testing - Completed. 

Phase 2 covers Supabase Auth, profile bootstrap, protected `/app`, logout, report API auth migration, and auth-aware landing CTAs.

### 2.1 Signed-Out Public And Protected Routes

Start signed out. Use incognito/private mode or visit:

```text
/auth/logout
```

Check public routes:

1. Visit `/login`.
   - Expected: login page renders normally.
   - Expected: `Continue with Google` is visible.
   - Expected: email-code form is visible.
2. Visit `/`.
   - Expected: landing page renders normally.
3. Visit `/legal`.
   - Expected: legal page renders normally.

Check protected routes:

1. Visit `/app`.
   - Expected: redirects to `/login?next=%2Fapp`.
2. Visit `/app/account?tab=profile`.
   - Expected: redirects to `/login?next=%2Fapp%2Faccount%3Ftab%3Dprofile`.
3. Visit `/app/portfolios`.
   - Expected: redirects to `/login?next=%2Fapp%2Fportfolios`.
4. Visit `/app/portfolios/new`.
   - Expected: redirects to `/login?next=%2Fapp%2Fportfolios%2Fnew`.

### 2.2 Signed-Out API Auth

While signed out, run in the browser console:

```js
await fetch("/api/v1/report-runs").then(async (r) => ({
  status: r.status,
  body: await r.json()
}))
```

Expected:

- status `401`
- body error code `UNAUTHORIZED`

Also run:

```js
await fetch("/api/v1/portfolios").then(async (r) => ({
  status: r.status,
  body: await r.json()
}))
```

Expected:

- status `401`
- body error code `UNAUTHORIZED`

### 2.3 Google Login

1. Visit `/login?next=/app`.
2. Click `Continue with Google`.
3. Complete Google OAuth.

Expected:

- browser returns through `/auth/callback`
- profile bootstrap succeeds
- `/app` loads
- app shell shows authenticated user/profile context
- refreshing `/app` keeps you authenticated

If this is the first login for this Google identity, also verify in Supabase:

- row exists in `auth.users`
- row exists in `public.user_profiles`
- profile email matches the Google account
- first/last name are populated from Google metadata when available

### 2.4 Email OTP First-Time User

Use a fresh test email or delete the prior local/dev test identity if you intentionally want the first-time path.

1. Visit `/login?next=/app`.
2. Enter the email address.
3. Request the email code.

Expected:

- page shows `Code sent. Check your email.`
- OTP/code input appears
- received email includes a visible six-digit code

4. Enter the six-digit code.

Expected:

- authentication succeeds
- if first/last name are missing, app routes to the profile-completion step inside the login shell
- after completing profile names, app redirects to `/app`
- `public.user_profiles` has the authenticated user's ID, email, first name, last name, and generated handle

Important provider-template check:

- The Supabase `Confirm sign up` template should include `{{ .Token }}`.
- The Supabase `Magic link or OTP` template should include `{{ .Token }}`.
- If either template includes a fallback link, the redirect URL must be allow-listed and route back to `/auth/callback`.

### 2.5 Email OTP Returning User

Use the same email from the prior OTP test.

1. Visit `/login?next=/app`.
2. Request another email code.
3. Confirm the received email includes a visible six-digit code.
4. Enter the code.

Expected:

- authentication succeeds
- app redirects to `/app`
- no duplicate `public.user_profiles` row is created
- profile data remains stable

If Supabase returns an email rate-limit message during repeated tests:

- expected app behavior is a clear wait-and-retry message
- do not treat this as a product failure unless the app crashes or exposes sensitive details

### 2.6 Logout

While signed in:

1. Use the app-shell logout control, or visit `/auth/logout`.
2. Confirm browser returns to `/` or another safe public route.
3. Visit `/app`.

Expected:

- `/app` redirects to `/login?next=%2Fapp`
- no authenticated app shell remains available after logout

### 2.7 Landing CTA Behavior

Signed-out flow:

1. Sign out or use incognito/private mode.
2. Visit `/`.
3. Confirm landing page renders normally.
4. Confirm report-start CTAs are visible:
   - header `Get One-Time Report`
   - hero `Generate One-Time Report`
   - final section `Generate My Report`
5. Click one report-start CTA.

Expected:

- browser lands on `/login?next=%2Fapp`
- login page shows `Continue with Google`
- login page shows email-code form

Sample PDF flow:

1. Return to `/`.
2. Click `View Sample PDF`.

Expected:

- browser stays on the landing page
- URL hash becomes `#sample-report-preview`
- sample report preview section is shown

Signed-in flow:

1. Sign in with Google or email OTP.
2. Visit `/`.
3. Click one report-start CTA.

Expected:

- browser goes to `/app`
- authenticated app shell loads

Console expectation:

- no runtime console errors
- no CSP errors
- no hydration errors

### 2.8 Report API Auth Checks

While signed in, run:

```js
await fetch("/api/v1/report-runs/not-a-uuid").then(async (r) => ({
  status: r.status,
  body: await r.json()
}))
```

Expected:

- status `400`
- body error code `INVALID_RUN_ID`
- this proves the request passed authentication and reached route validation

The stronger owned-portfolio positive-path report API check is listed in Phase 3 section 3.13 because it needs a real owned portfolio.

## 3) Phase 3 Manual Testing

Phase 3 covers:

```text
Create portfolio -> add holdings -> review portfolio readiness
```

### 3.1 Signed-In Dashboard

1. Sign in.
2. Visit `/app`.

Expected:

- authenticated app shell loads
- `Portfolios` navigation is visible
- portfolio dashboard section is visible
- if no active portfolios exist, dashboard CTA is `Create Portfolio`
- if active portfolios exist, dashboard CTA is `View Portfolios` or equivalent portfolio-list action
- report-related dashboard or navigation affordances should not expose data while signed out
- full report-generation behavior is covered in Phase 4 below

### 3.2 Portfolio List Empty State 

1. Click `Portfolios` in the app shell.
2. Confirm `/app/portfolios` opens.

If no active portfolios exist:

- empty state appears
- `Create Portfolio` action is visible

If active portfolios exist:

- portfolio rows/cards appear
- each active portfolio has a view/detail path
- archived portfolios should not appear

### 3.3 Create Manual Portfolio 

1. Open `/app/portfolios/new`.
2. Create a test portfolio:
   - Name: `Phase 3 Manual Test`
   - Description: `Manual smoke test portfolio`
   - Base currency: `CAD` or `USD`
3. Save.

Expected:

- form validates required fields
- create succeeds
- browser redirects to portfolio detail page
- detail page shows portfolio name, description, base currency, and readiness state

### 3.4 Verify Portfolio DB Ownership

In Supabase Table Editor, inspect the new `public.portfolios` row.

Expected:

- `user_id` equals the signed-in Supabase Auth user ID
- `name` matches the created portfolio
- `base_currency` is `CAD` or `USD`
- `archived_at` is empty/null

### 3.5 Edit Portfolio Metadata 

1. From the detail page or list, open portfolio edit.
2. Change:
   - name
   - description
   - base currency if appropriate
3. Save.

Expected:

- save succeeds
- browser returns to portfolio detail page
- updated metadata is visible
- invalid currency or missing name shows a friendly validation error

### 3.6 Not-Ready State Before Holdings

On the portfolio detail page before adding holdings:

Expected:

- portfolio is clearly not ready
- copy indicates holdings are needed
- report-generation action remains disabled, for example `Add holdings first`
- page does not call `report-runs`

### 3.7 Add Holding With Ticker Autocomplete

Use this step with the market-data adapter running.

1. On portfolio detail, find the add holding form.
2. In ticker field, type `Apple` or `AAPL`.
3. Wait for search/autocomplete results.
4. Select a result.

Expected:

- results appear in a dropdown/list
- selecting a result prefills ticker
- security name is prefilled when available
- currency is prefilled when it is supported (`USD` or `CAD`)
- no provider secret or raw provider payload is visible in the UI
- no quote/price/market value preview is shown

Complete the holding:

- Quantity: `10.1234567890`
- Average cost: `123.45678901`
- Notes: optional

Save.

Expected:

- holding appears in the holdings list
- ticker is normalized/uppercase where applicable
- quantity and average cost display without losing meaningful precision
- estimated cost basis appears if the UI shows it
- portfolio readiness changes to ready once at least one holding exists

### 3.8 Verify Holding DB Ownership 

In Supabase Table Editor, inspect the new `public.portfolio_holdings` row.

Expected:

- `user_id` equals the signed-in Supabase Auth user ID
- `portfolio_id` points to the created portfolio
- `ticker` matches the saved ticker
- `quantity` preserves the entered precision
- `average_cost` preserves the entered precision

### 3.9 Add Holding With Manual Ticker Fallback

Use this whether or not autocomplete is running.

1. Add another holding.
2. Type a ticker manually and do not select any search result.
   - Example: `SHOP.TO`
3. Enter security name manually if the field is available.
4. Choose supported currency.
5. Enter quantity and average cost.
6. Save.

Expected:

- manual ticker entry saves
- autocomplete is not mandatory
- no warning claims the ticker has been market-validated

If the search endpoint is down or returns no matches:

- user should see fallback copy such as manual entry being okay
- saving a valid manual ticker should still work

### 3.10 Duplicate Ticker Handling

1. Try adding the same ticker again to the same portfolio.

Expected:

- save is rejected safely
- message is friendly, for example:
  - `This ticker is already in the portfolio. Edit the existing holding instead.`
- app does not crash
- no duplicate holding row is created

### 3.11 Edit Holding 

1. Edit an existing holding.
2. Change one or more fields:
   - quantity
   - average cost
   - notes
   - ticker, if you want to test ticker updates
3. Save.

Expected:

- update succeeds
- detail page shows updated holding
- duplicate ticker update is rejected if the new ticker already exists in the same portfolio
- decimal values remain precise enough for the entered values

### 3.12 Remove Holding  

1. Attempt to remove a holding.
2. If confirmation is required, first try without confirmation if the UI exposes that path.

Expected:

- remove is blocked until explicit confirmation is provided

Then confirm removal.

Expected:

- holding disappears
- no unrelated holdings are removed
- if the portfolio has no holdings left, readiness returns to not-ready

### 3.13 Owned-Portfolio Report API Positive Path

Use an active owned portfolio ID from the URL:

```text
/app/portfolios/<portfolioId>
```

While signed in, run in browser console:

```js
await fetch("/api/v1/report-runs", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-user-id": "b7a6e76d-c1fb-4756-8bfb-0b8e05427e87"
  },
  body: JSON.stringify({
    portfolioId: "8f15a14e-efa4-41df-bd68-c256242b68c8",
    reportingCurrency: "CAD",
    userId: "b7a6e76d-c1fb-4756-8bfb-0b8e05427e87"
  })
}).then(async (r) => ({
  status: r.status,
  body: await r.json()
}))
```

Expected:

- status `201`
- body includes `runId`
- body status is `QUEUED`
- spoofed `x-user-id` and body `userId` do not control ownership
- if the worker is running, the run may move quickly to `PROCESSING`, `COMPLETED`, or `FAILED`; copy the `runId` immediately for follow-up checks

In Supabase Table Editor, inspect `public.report_runs` for the returned `runId`.

Expected:

- `user_id` equals the signed-in Supabase Auth user ID
- `user_id` does not equal `11111111-1111-4111-8111-111111111111`
- `portfolio_id` equals the owned portfolio ID

Optional status check:

```js
await fetch("/api/v1/report-runs/<runId>").then(async (r) => ({
  status: r.status,
  body: await r.json()
}))
```

Expected:

- status `200`
- response includes the same `runId`

Optional PDF-route check while the run is still active or before report completion:

```js
await fetch("/api/v1/report-runs/<runId>/pdf").then(async (r) => ({
  status: r.status,
  body: await r.json()
}))
```

Expected while the PDF artifact is not ready yet:

- status `404`
- body error code `ARTIFACT_NOT_FOUND`

### 3.14 Archive Portfolio

1. Open the portfolio edit/detail/list archive action.
2. Archive the test portfolio.

Expected:

- archive succeeds
- portfolio disappears from `/app/portfolios`
- dashboard no longer counts the archived portfolio as active
- direct old detail URL no longer shows active portfolio detail

In Supabase Table Editor:

- `portfolios.archived_at` is set
- holding rows remain preserved

### 3.15 Signed-Out Portfolio And Search Access

Sign out.

Check browser routes:

1. Visit `/app`.
   - Expected: redirects to `/login?next=%2Fapp`.
2. Visit `/app/portfolios`.
   - Expected: redirects to login with `next`.
3. Visit `/app/portfolios/new`.
   - Expected: redirects to login with `next`.
4. Visit an old portfolio detail URL.
   - Expected: redirects to login with `next`.

Run in browser console while signed out:

```js
await fetch("/api/v1/portfolios").then(async (r) => ({
  status: r.status,
  body: await r.json()
}))
```

Expected:

- status `401`
- body error code `UNAUTHORIZED`

Run:

```js
await fetch("/api/v1/securities/search?query=Apple").then(async (r) => ({
  status: r.status,
  body: await r.json()
}))
```

Expected:

- status `401`
- body error code `UNAUTHORIZED`

### 3.16 Cross-User Ownership Check

Run this only if you have two local/dev auth accounts.

1. Sign in as User A.
2. Create a portfolio and copy its detail URL.
3. Sign out.
4. Sign in as User B.
5. Paste User A's portfolio detail URL.

Expected:

- User B cannot view User A's portfolio.

Also try API access from User B:

```js
await fetch("/api/v1/portfolios/<user-a-portfolio-id>").then(async (r) => ({
  status: r.status,
  body: await r.json()
}))
```

Expected:

- status `404` or equivalent not-found/not-owned response
- no User A data is exposed

## 4) Phase 4 Manual Testing

Phase 4 covers:

```text
Ready portfolio -> Generate report -> Watch progress -> Download PDF -> Review report history
```

Before starting Phase 4:

- complete the local setup steps above
- keep Next.js running
- keep the market-data adapter running
- keep the Graphile worker running for the happy path
- keep DevTools Console open
- sign in through the app using Google or email OTP
- use an active owned portfolio with at least one holding
- prefer a small manual test portfolio with supported tickers such as `AAPL` and `MSFT`
- use reporting currency `USD` first to avoid mixing Phase 4 UI validation with extra FX edge cases

### 4.1 Reports Navigation

1. Sign in.
2. Visit `/app`.
3. Click `Reports` in the app shell.

Expected:

- `/app/reports` loads
- navigation item is live, not disabled
- if no report runs exist, an empty state appears
- if report runs exist, report rows appear
- each row shows portfolio name, status, currency, requested date, completed/failed date when available, and a status-page link

### 4.2 Ready Portfolio Report Controls

1. Open an owned portfolio detail page:

```text
/app/portfolios/<portfolioId>
```

2. Confirm the portfolio has at least one saved holding.

Expected:

- readiness shows `Ready for report`
- report-generation panel is visible
- report currency selector is visible
- selector options are `CAD` and `USD`
- default selected currency matches the portfolio base currency
- `Generate report` action is enabled
- no raw pipeline JSON or provider errors are visible

### 4.3 Generate Report From Portfolio Detail

1. Set report currency to `USD` or the desired test currency.
2. Click `Generate report`.

Expected:

- duplicate-click damping appears while the form is pending
- browser redirects to:

```text
/app/reports/<runId>
```

- status page title is `Report Status | Second Act`
- page shows source portfolio name
- page shows selected reporting currency
- page shows requested timestamp
- page starts in `QUEUED` or quickly moves to `PROCESSING`
- page shows calm active-state copy:
  - queued: `Your report is in line to be generated.`
  - processing: `We are building your report now.`
- page shows `Checking for updates...` while active

In the worker terminal, expected logs include:

- report run job received
- `QUEUED -> PROCESSING`
- canonical model stage started/completed
- analysis stage started/completed
- narrative stage started/completed
- PDF render stage started/completed
- artifact storage stage started/completed
- `PROCESSING -> COMPLETED`

### 4.4 Completed Status And PDF Access

Wait until the status page reaches `COMPLETED`.

Expected:

- status badge is `COMPLETED`
- title is `Your report is ready.`
- completed timestamp is populated
- failed timestamp remains `Not yet`
- `Open PDF` action is visible
- `Retry report` is not visible on a completed run

Click `Open PDF`.

Expected:

- signed PDF opens in a new tab or downloads, depending on browser settings
- request returns `200 OK`
- response content type is `application/pdf`
- no signed URL is permanently displayed in app UI
- no storage bucket secret or service-role key is visible

Optional browser-console check from the completed status page:

```js
await fetch("/api/v1/report-runs/<runId>/pdf").then(async (r) => ({
  status: r.status,
  body: await r.json()
}))
```

Expected:

- status `200`
- body includes a temporary `signedUrl`
- body does not include storage service credentials

### 4.5 Report History Page

After a report completes:

1. Visit `/app/reports`.
2. Locate the completed run.

Expected:

- row shows source portfolio name
- row status is `COMPLETED`
- row currency matches the generated run
- row requested timestamp is present
- row completed timestamp is present
- `View status` links to `/app/reports/<runId>`
- clicking source portfolio returns to the portfolio detail page

### 4.6 Portfolio Detail Report Preview

Return to:

```text
/app/portfolios/<portfolioId>
```

Expected:

- report history panel is visible on the portfolio detail page
- if there is no active run, copy says the latest completed report is ready to revisit
- `Open completed report` links to `/app/reports/<runId>`
- recent report list includes status, currency, date, and a status-page link
- if an active run exists, the active run is prioritized over the completed run

### 4.7 Supabase Report-Run Verification

In Supabase Table Editor, inspect `public.report_runs` for the completed `runId`.

Expected:

- `id` equals the browser `runId`
- `user_id` equals the signed-in Supabase Auth user ID
- `portfolio_id` equals the source portfolio ID
- `reporting_currency` equals the selected currency
- `status` is `COMPLETED`
- `payment_status` is `NOT_REQUIRED`
- `started_at` is populated
- `completed_at` is populated
- `failed_at` is null
- `market_data_provider` is populated
- `narrative_provider` is populated
- raw JSON columns are not exposed in browser/API responses

Inspect `public.report_artifacts`.

Expected:

- row exists for the completed `runId`
- `artifact_type` is `PDF_REPORT`
- `storage_bucket` matches the configured reports bucket
- `storage_path` ends with:

```text
/<runId>/report.pdf
```

- `mime_type` is `application/pdf`
- `file_size_bytes` is greater than zero
- checksum is present if configured by the pipeline

Inspect Supabase Storage.

Expected:

- object exists at the artifact `storage_path`
- object is in the configured private reports bucket
- downloaded object opens as a PDF

### 4.8 Report API Auth And Ownership Checks

While signed out, run:

```js
await fetch("/api/v1/report-runs").then(async (r) => ({
  status: r.status,
  body: await r.json()
}))
```

Expected:

- status `401`
- body error code `UNAUTHORIZED`

While signed in as the report owner, run:

```js
await fetch("/api/v1/report-runs").then(async (r) => ({
  status: r.status,
  body: await r.json()
}))
```

Expected:

- status `200`
- body includes only the signed-in user's report runs
- completed run appears with safe summary fields
- body does not include `canonicalSnapshot`, `analysisOutput`, `narrativeOutput`, or `errorDetails`

Run:

```js
await fetch("/api/v1/report-runs/<runId>").then(async (r) => ({
  status: r.status,
  body: await r.json()
}))
```

Expected:

- status `200`
- body includes the same `runId`
- body includes portfolio name, status, payment status, reporting currency, and timestamps
- body does not include raw pipeline JSON

If you have two auth accounts, repeat the status and PDF-route checks as User B against User A's `runId`.

Expected:

- User B receives `404` or equivalent not-found/not-owned response
- no User A report metadata or signed PDF URL is exposed

### 4.9 Worker-Stopped Queued Drill

Use a disposable test portfolio. Do not run this drill against data you care about preserving clean history for.

1. Stop the Graphile worker.
2. Keep Next.js and the market-data adapter running.
3. Generate a report from a ready portfolio.

Expected:

- browser redirects to `/app/reports/<runId>`
- status remains `QUEUED`
- title is `Your report is in line to be generated.`
- body says `We will keep checking for updates.`
- started, completed, and failed timestamps remain `Not yet`
- after the long-running threshold, the page explains that local queued reports wait until the background process is running

Restart the worker when done.

Expected:

- report moves to `PROCESSING`
- if all services are healthy, report eventually completes

### 4.10 Market-Data Adapter Failure Drill

Use a disposable test portfolio/run.

1. Stop the Graphile worker.
2. Generate a report and confirm the status page is `QUEUED`.
3. Stop the market-data adapter.
4. Restart the worker while the adapter remains stopped.

Expected:

- worker picks up the queued run
- worker logs `QUEUED -> PROCESSING`
- worker fails during the market-data/canonical stage
- browser status page updates without manual refresh
- final status is `FAILED`
- title is `We could not finish this report.`
- friendly message is shown:

```text
We could not prepare the market-data snapshot for this report. Check that the holdings use supported tickers and try again.
```

- failed timestamp is populated
- completed timestamp remains `Not yet`
- `Retry report` action is visible
- raw provider exception text, worker stack traces, and secrets are not visible in the browser

Restore services after the drill.

Terminal 1:

```bash
npm run worker:dev
```

Terminal 2:

```bash
cd services/market-data-adapter
source .venv/bin/activate
export MARKET_DATA_ADAPTER_INTERNAL_API_SECRET="<same value as .env>"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Health-check the adapter again:

```bash
curl -i http://127.0.0.1:8000/health
```

### 4.11 Retry Failed Report

From a failed report status page:

1. Confirm `Retry report` is visible.
2. Restore the worker and market-data adapter.
3. Click `Retry report`.

Expected:

- browser redirects to an active or new report status page
- retry does not mutate the failed run into completed
- failed run remains visible in `/app/reports`
- new run uses the same source portfolio and reporting currency
- new run follows the normal queued/processing/completed flow if services are healthy

## 5) Phase 5 Manual Testing

Phase 5 covers:

```text
Account profile -> portfolio-scoped report library -> report management -> dashboard report summary
```

Before starting Phase 5:

- complete the local setup steps above
- keep Next.js running
- keep the market-data adapter running for fresh report generation
- keep the Graphile worker running for happy-path report completion
- keep DevTools Console open
- sign in through the app using Google or email OTP
- use an active owned portfolio with at least one holding
- have at least one completed report available, or generate one using the Phase 4 flow
- use disposable report runs for delete/storage-cleanup checks

### 5.1 Account Profile View And Edit

1. Sign in.
2. Visit `/app/account`.

Expected:

- page title is `Profile`
- first name is visible
- last name is visible
- email is visible and marked read-only
- investor handle is visible and marked read-only
- created timestamp is visible
- updated timestamp is visible
- no billing controls are visible
- no payment controls are visible
- no full account deletion control is visible

Edit name:

1. Change first name.
2. Change last name.
3. Save.

Expected:

- page returns to `/app/account?notice=profile_updated`
- success message says `Profile updated.`
- app shell display name reflects the new first/last name after refresh/navigation
- `public.user_profiles.first_name` and `public.user_profiles.last_name` update for the signed-in user
- `public.user_profiles.email` remains unchanged
- `public.user_profiles.investor_handle` remains unchanged

Validation drill:

1. Clear first name or last name.
2. Save.

Expected:

- save is blocked by browser required validation or server redirects to `/app/account?error=profile_validation_error`
- friendly copy asks for both first and last name
- no raw Supabase/Auth/Prisma error is shown

### 5.2 Dashboard Latest Report Summary

1. Visit `/app`.

If at least one report run exists:

- dashboard shows a latest-report section
- latest report portfolio name is visible
- status is visible
- reporting currency is visible
- requested/completed/failed date is visible
- `Open Report` links to `/app/reports/<runId>`
- `Reports` links to `/app/reports`
- portfolio summary still appears

If no report runs exist:

- dashboard shows a no-report state
- copy points the user toward portfolios
- if no portfolios exist, CTA points to `/app/portfolios/new`
- if portfolios exist, CTA points to `/app/portfolios`

### 5.3 Portfolio-Scoped Report Library Link 

1. Open an owned portfolio detail page:

```text
/app/portfolios/<portfolioId>
```

Expected:

- report preview panel is visible
- `View all reports for this portfolio` is visible
- link target is `/app/reports?portfolioId=<portfolioId>`

Click the link.

Expected:

- `/app/reports?portfolioId=<portfolioId>` loads
- library shows only report runs for that portfolio
- filter bar indicates portfolio scope is active
- clearing portfolio scope returns to `/app/reports`

### 5.4 Report Library Filters

From `/app/reports`:

1. Set status filter to `Completed`.
2. Apply filters.

Expected:

- URL includes `status=COMPLETED`
- completed reports are shown
- active and failed reports are not shown
- summary counts remain useful for the current library scope

Then:

1. Set currency filter to `CAD` or `USD`.
2. Apply filters.

Expected:

- URL includes `reportingCurrency=CAD` or `reportingCurrency=USD`
- visible rows match the selected reporting currency
- raw pipeline JSON is not visible
- raw provider details are not visible

No-results drill:

1. Choose a filter combination that has no matches.

Expected:

- no-results empty state appears
- copy says no reports match the filters
- clear/reset filter action is visible

### 5.5 Completed Report Library Actions

Find a completed report row in `/app/reports`.

Expected row actions:

- `Report details`
- `Open PDF`
- `Generate fresh report`
- `Delete report`

Open PDF:

1. Click `Open PDF`.

Expected:

- signed PDF opens in a new tab or downloads
- no signed URL is permanently rendered into the report-list response
- no bucket path or service role key is visible

Generate fresh report:

1. Click `Generate fresh report`.

Expected:

- if no active report exists for that portfolio, a new report run is created
- browser redirects to `/app/reports/<newRunId>`
- new run uses the same source portfolio and reporting currency
- if an active report already exists for the portfolio, browser redirects to that active run instead of creating a duplicate. Active report means if there is a report already in in-progress or queued status. If there is a report already in completed or failed status, it will create a new report for that portfolio.

### 5.6 Completed Report Delete And Storage Cleanup

Use a disposable completed report.

Before deleting, record from Supabase:

- `public.report_runs.id`
- `public.report_artifacts.report_run_id`
- `public.report_artifacts.storage_bucket`
- `public.report_artifacts.storage_path`
- private Storage object path

Delete from the library or report detail:

1. Click `Delete report`.
2. Confirm the browser confirmation prompt.

Expected browser behavior:

- delete succeeds
- browser returns to `/app/reports?notice=report_deleted` or preserves current filters with `notice=report_deleted`
- deleted report no longer appears in the library
- old `/app/reports/<runId>` no longer exposes report detail

Expected Supabase behavior:

- deleted `public.report_runs` row is gone
- matching `public.report_artifacts` row is gone
- private Storage PDF object is gone
- other users' report rows/artifacts are untouched

Storage failure drill, if you can safely simulate it:

1. Temporarily make storage deletion fail, or disconnect storage in a disposable local setup.
2. Attempt completed-report deletion.

Expected:

- app shows a friendly retryable delete/storage error
- report-run metadata remains present
- private PDF object is not orphaned by a false success

### 5.7 Failed Report Management

Use an existing failed report from the Phase 4 failure drill or create a disposable failed run.

From `/app/reports` or `/app/reports/<runId>`:

Expected:

- failed report shows `Retry report`
- failed report shows `Delete report` or `Delete failed report`
- `Open PDF` is not shown for failed runs

Retry:

1. Restore worker and market-data adapter.
2. Click `Retry report`.

Expected:

- browser redirects to an active/new report status page
- failed run remains available unless explicitly deleted
- new run uses the same portfolio and reporting currency

Delete:

1. Click failed-report delete.
2. Confirm if prompted.

Expected:

- failed run disappears from report library
- `public.report_runs` row is removed
- related artifact metadata is removed if any exists
- no PDF artifact is required for failed-report deletion

### 5.8 Active Report Management Restrictions

Create or use a `QUEUED` or `PROCESSING` report.

Expected in `/app/reports`:

- active report is visible
- status is `QUEUED` or `PROCESSING`
- active row links to status/detail
- active row does not show delete
- active row does not show Open PDF
- active row communicates management unlocks after the run finishes

Expected in `/app/reports/<runId>`:

- active polling remains visible
- `Back to Reports` is visible
- `Back to Portfolio` is visible
- delete action is not visible
- long-running local queued/processing copy remains friendly

Optional API check while signed in as owner:

```js
await fetch("/api/v1/report-runs/<activeRunId>", {
  method: "DELETE"
}).then(async (r) => ({
  status: r.status,
  body: await r.json()
}))
```

Expected:

- status `409`
- body error code `REPORT_RUN_NOT_TERMINAL`

### 5.9 Report Detail State Actions

For a completed report detail page:

- `Open PDF` is visible
- `Generate fresh report` is visible
- `Delete report` is visible
- `Back to Reports` is visible
- `Back to Portfolio` is visible
- copy says the report is ready and can be revisited

For a failed report detail page:

- friendly failure reason is visible
- `Retry report` is visible
- `Delete failed report` is visible
- `Back to Reports` is visible
- `Back to Portfolio` is visible
- raw worker/provider errors are not visible

For an active report detail page:

- polling remains active
- active status copy remains visible
- terminal delete/fresh-report actions are hidden

### 5.10 Cross-User Report Library And Delete Protection

Run this only if you have two local/dev auth accounts.

1. Sign in as User A.
2. Create or choose a report run and copy:
   - `/app/reports/<runId>`
   - `/app/reports?portfolioId=<portfolioId>`
3. Sign out.
4. Sign in as User B.
5. Open User A's report detail URL.

Expected:

- User B receives not-found behavior
- User A report metadata is not shown
- User A PDF cannot be opened

List isolation:

1. As User B, visit `/app/reports`.

Expected:

- User A's report runs are absent

Portfolio-scoped isolation:

1. As User B, visit User A's `/app/reports?portfolioId=<portfolioId>`.

Expected:

- app returns not-found behavior or otherwise does not show User A reports

Delete protection:

```js
await fetch("/api/v1/report-runs/<userARunId>", {
  method: "DELETE"
}).then(async (r) => ({
  status: r.status,
  body: r.status === 204 ? null : await r.json()
}))
```

Expected:

- status `404`
- User A report row and artifact remain untouched

### 5.11 Signed-Out Phase 5 API Checks - Completed

Sign out or use incognito/private mode.

Report list:

```js
await fetch("/api/v1/report-runs?status=COMPLETED&reportingCurrency=CAD").then(async (r) => ({
  status: r.status,
  body: await r.json()
}))
```

Expected:

- status `401`
- body error code `UNAUTHORIZED`

Report delete:

```js
await fetch("/api/v1/report-runs/<runId>", {
  method: "DELETE"
}).then(async (r) => ({
  status: r.status,
  body: await r.json()
}))
```

Expected:

- status `401`
- body error code `UNAUTHORIZED`

Signed-out app routes:

1. Visit `/app/reports`.
2. Visit `/app/account`.
3. Visit `/app/portfolios/<portfolioId>`.

Expected:

- each route redirects to login with a safe `next` value
- no private app data is shown

## 6) Final Automated Gate

Run after manual testing:

```bash
npm test
npm run typecheck
npm run lint
services/market-data-adapter/.venv/bin/pytest services/market-data-adapter/tests
npm run build
git diff --check
```

Expected:

- all commands pass

## 7) Cleanup

Preferred cleanup:

1. Archive test portfolios from the UI.
2. Confirm archived portfolios disappear from `/app/portfolios`.

If direct database cleanup is needed:

1. Confirm the test portfolio has no important report runs or report artifacts.
2. Delete only test data you created.
3. Delete matching private Storage test PDFs only when you are sure they belong to test runs.
4. Keep ownership relationships in mind:
   - `portfolio_holdings.portfolio_id`
   - `report_runs.portfolio_id`
   - `report_artifacts.report_run_id`
   - `report_artifacts.storage_path`
   - `portfolios.user_id`
   - `portfolio_holdings.user_id`
   - `report_runs.user_id`
   - `report_artifacts.user_id`

## 8) Signoff Summary

Use this section to record your manual test result.

```text
Tester:
Date:
Browser:
Auth provider tested:
Phase 2 signed-out route guard:
Phase 2 Google login:
Phase 2 email OTP first-time:
Phase 2 email OTP returning:
Phase 2 logout:
Phase 2 landing CTAs:
Phase 2 report API auth:
Phase 3 dashboard/list:
Phase 3 create/edit/archive portfolio:
Phase 3 holdings add/edit/remove:
Phase 3 ticker autocomplete:
Phase 3 manual ticker fallback:
Phase 3 duplicate ticker handling:
Phase 3 DB ownership checks:
Phase 3 report API positive path:
Phase 3 signed-out API checks:
Phase 4 reports navigation:
Phase 4 ready portfolio generate controls:
Phase 4 generate/status flow:
Phase 4 completed PDF access:
Phase 4 reports history:
Phase 4 portfolio report preview:
Phase 4 Supabase report/artifact/storage checks:
Phase 4 signed-out and cross-user report auth:
Phase 4 queued drill:
Phase 4 market-data failure drill:
Phase 4 retry failed report:
Phase 5 account profile view/edit:
Phase 5 dashboard latest-report summary:
Phase 5 portfolio-scoped report library:
Phase 5 report library filters:
Phase 5 completed report PDF/fresh-run actions:
Phase 5 completed report delete/storage cleanup:
Phase 5 failed report retry/delete:
Phase 5 active report management restrictions:
Phase 5 report detail state actions:
Phase 5 cross-user report protection:
Phase 5 signed-out API checks:
Final automated gate:
Notes:
```
