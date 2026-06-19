# Manual Testing Steps

Last updated: 2026-06-18

Purpose:

- Provide one browser-ready manual testing checklist for Phase 2 auth/app-shell behavior and Phase 3 portfolio management.
- Keep this document focused on local manual validation. Automated test evidence remains in the phase execution notes.
- Treat report-generation UI as out of scope for this checklist. Phase 3 should still show `Report generation comes next` instead of a working report-generation UI.

## 1) Local Setup

### 1.1 Start Next.js

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

### 1.2 Start Market-Data Adapter For Ticker Search

Run this if you want ticker autocomplete to return real local results.

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

### 1.3 Browser Setup

Use either:

- one normal browser session for signed-in tests
- one incognito/private session for signed-out tests

Keep DevTools Console open during the main browser flows.

Expected:

- no CSP errors
- no hydration errors
- no uncaught runtime errors

## 2) Phase 2 Manual Testing

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
- report card says `Report generation comes next`

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
- report-generation action remains informational/disabled
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

### 3.13 Deferred Phase 2 Owned-Portfolio Report API Positive Path

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
    "x-user-id": "11111111-1111-4111-8111-111111111111"
  },
  body: JSON.stringify({
    portfolioId: "<portfolioId>",
    reportingCurrency: "CAD",
    userId: "11111111-1111-4111-8111-111111111111"
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

Optional PDF-route check before report completion:

```js
await fetch("/api/v1/report-runs/<runId>/pdf").then(async (r) => ({
  status: r.status,
  body: await r.json()
}))
```

Expected before report completion:

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

## 4) Final Automated Gate

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

## 5) Cleanup

Preferred cleanup:

1. Archive test portfolios from the UI.
2. Confirm archived portfolios disappear from `/app/portfolios`.

If direct database cleanup is needed:

1. Confirm the test portfolio has no important report runs.
2. Delete only test data you created.
3. Keep ownership relationships in mind:
   - `portfolio_holdings.portfolio_id`
   - `report_runs.portfolio_id`
   - `portfolios.user_id`
   - `portfolio_holdings.user_id`
   - `report_runs.user_id`

## 6) Signoff Summary

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
Final automated gate:
Notes:
```
