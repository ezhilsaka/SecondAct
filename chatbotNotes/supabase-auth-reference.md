# Supabase Auth Reference

Last updated: 2026-03-28

## Purpose

This note captures the current authentication decision for Second Act so we do not lose context while building the Phase 1 backend pipeline.

Phase 1 is focused on:

`Portfolio -> Canonical Model -> Analysis Engine -> Narrative Engine -> PDF Generator`

Because of that, full authentication implementation is **not** part of current Step 2 execution. However, the database schema should remain **auth-ready** so later auth work can connect cleanly without a redesign.

## Decision Summary

Second Act will use **Supabase Auth** as the identity/authentication system.

Supported login/signup methods planned:

1. Google login
2. Email-based signup/login using one-time password (OTP)

This means we are **not** planning to build our own auth system from scratch.

## What Supabase Auth Means

Supabase Auth is the managed identity layer inside Supabase. It handles:

1. User identity records
2. Sessions
3. Access tokens / JWTs
4. Provider login flows such as Google OAuth
5. Passwordless email login flows such as OTP / magic link

Our application should use Supabase Auth for login, then store app-specific user profile data in our own table.

## Planned Split of Responsibility

### Supabase-managed identity

Supabase Auth should handle:

1. Google sign-in
2. Email OTP sign-in / signup
3. Session creation
4. Token issuance
5. Logged-in user identity

### App-owned profile data

Our application should store profile metadata in an app table named:

`user_profiles`

This table should contain fields such as:

1. `id`
2. `email`
3. `first_name`
4. `last_name`
5. `investor_handle`
6. timestamps

`user_profiles.id` should match the Supabase Auth user ID.

## Why This Is The Right Fit

Using Supabase Auth lets us keep:

1. Google login
2. Email OTP login/signup

while avoiding custom auth work for:

1. session security
2. token management
3. provider integration
4. auth storage design

This keeps the backend simpler and safer, and it matches our Supabase-based stack.

## Planned User Model

### Identity source of truth

Identity source of truth should be:

`auth.users` in Supabase Auth

### App profile source of truth

Application profile source of truth should be:

`public.user_profiles`

### Planned profile fields

Initial app-level profile fields:

1. `id uuid primary key`
2. `email text unique not null`
3. `first_name text not null`
4. `last_name text not null`
5. `investor_handle text unique not null`
6. `created_at timestamptz not null`
7. `updated_at timestamptz not null`

## Planned Authentication Flows

### Google login

User flow:

1. User clicks "Continue with Google"
2. Supabase Auth redirects through Google OAuth
3. Supabase Auth returns an authenticated session
4. App checks if `user_profiles` row exists
5. If not, app creates `user_profiles` using the authenticated user ID

### Email OTP signup/login

User flow:

1. User enters email address
2. App calls Supabase Auth OTP sign-in method
3. User receives one-time code by email
4. User enters code
5. Supabase Auth verifies the code and creates a session
6. App checks if `user_profiles` row exists
7. If not, app creates `user_profiles`

Template requirement:

- For OTP code entry, the Supabase email templates must expose `{{ .Token }}`.
- Configure both:
  - `Confirm sign up`, used by first-time passwordless email users
  - `Magic link or OTP`, used by returning passwordless email users
- A link-only `Confirm sign up` template will create a mismatch where the app asks for a code but the user receives only a confirmation link.

## Important Product Note

The product still supports both intended entry paths:

1. Google login
2. Standalone email-based registration/login with OTP

Moving to Supabase Auth does **not** remove either path. It simply means Supabase handles identity and session mechanics for them.

## Phase 1 Scope Boundary

### What is in scope now

For the current backend pipeline phase:

1. Make the schema auth-ready
2. Add `user_profiles`
3. Ensure all portfolio/report tables are linked by `user_id`
4. Seed test data for a backend-only test user

### What is deferred until later

Later auth work should implement:

1. Google login UI and callback handling
2. Email OTP UI and verification flow
3. Session handling in the Next.js app
4. Protected routes / auth middleware
5. Automatic profile creation after first login
6. Row Level Security (RLS) policies

## Relationship To Current Data Model

Current schema direction should assume:

1. `user_profiles.id` is the application user key
2. `portfolios.user_id` points to `user_profiles.id`
3. `portfolio_holdings.user_id` points to `user_profiles.id`
4. `report_runs.user_id` points to `user_profiles.id`
5. `report_artifacts.user_id` points to `user_profiles.id`
6. `user_usage.user_id` points to `user_profiles.id`

This keeps pricing, ownership, authorization, and auditing consistently tied to the user.

## Investor Handle

We decided to keep an app-owned unique user alias:

`investor_handle`

Current status:

1. It may be shown in the UI later
2. Exact generation logic is not finalized yet
3. Schema should support it now as a unique string field

This means we can finalize the "catchy" naming strategy later without changing the table design.

## Free Tier And Production Notes

As of 2026-03-28, Supabase documentation indicates:

1. Free plan includes Auth usage quotas
2. Free plan includes monthly active user quotas
3. Google login is supported
4. Passwordless email login is supported

Important production note:

Hosted Supabase email auth is fine for development and testing, but real production OTP delivery usually requires configuring your own SMTP provider.

So:

1. Google login can work cleanly for development and production
2. Email OTP can be tested during development
3. Production email OTP should plan for custom SMTP setup

## Security Notes For Later

When auth is implemented later, we should follow these rules:

1. Never expose service role keys to the client
2. Use the anon/public key only in browser-safe contexts
3. Keep privileged database actions in server-side code only
4. Add Row Level Security policies for user-owned tables
5. Use authenticated Supabase user ID as the source for ownership checks

## Phase 2 Implementation Status

As of 2026-06-10, the Phase 2 implementation has completed the core app-side auth foundation:

1. Google login and email OTP login use Supabase Auth.
2. The app uses Supabase SSR/browser clients for cookie-based sessions.
3. The Next.js route guard has migrated from deprecated `src/middleware.ts` to `src/proxy.ts`.
4. The proxy keeps explicit public routes open and protects app/API routes by checking the Supabase session.
5. `/app` also verifies the authenticated user at the server layout boundary.
6. `user_profiles` and `user_usage` bootstrap from the authenticated Supabase user.
7. Existing report API routes now use the authenticated Supabase user ID instead of `X-User-Id`.
8. `X-User-Id` is no longer the production route-auth mechanism.
9. Row Level Security policy hardening remains a production/security follow-up unless selected explicitly.

## Recommended Later Implementation Sequence

When we pick up auth implementation later, the recommended order is:

1. Enable Google provider in Supabase Auth
2. Enable email OTP flow and configure templates
3. Add client-side Supabase auth integration in Next.js
4. Add login/signup UI
5. Add profile bootstrap logic for `user_profiles`
6. Add route protection / middleware
7. Add RLS policies
8. Test Google login, OTP login, logout, and session persistence

## Notes To Preserve For Phase 1

These items should remain true while building the backend pipeline now:

1. Full auth implementation is deferred
2. Schema must remain auth-ready
3. `user_profiles` is the app-owned profile table
4. Supabase Auth is the future identity provider
5. Backend test users can be seeded for pipeline development before auth UI exists

## References

Official Supabase docs used for this note:

1. Auth overview: [https://supabase.com/docs/guides/auth](https://supabase.com/docs/guides/auth)
2. Passwordless email logins / OTP: [https://supabase.com/docs/guides/auth/auth-email-passwordless](https://supabase.com/docs/guides/auth/auth-email-passwordless)
3. Google login: [https://supabase.com/docs/guides/auth/social-login/auth-google](https://supabase.com/docs/guides/auth/social-login/auth-google)
4. Social login overview: [https://supabase.com/docs/guides/auth/social-login](https://supabase.com/docs/guides/auth/social-login)
5. Billing / free plan usage: [https://supabase.com/docs/guides/platform/billing-on-supabase](https://supabase.com/docs/guides/platform/billing-on-supabase)
