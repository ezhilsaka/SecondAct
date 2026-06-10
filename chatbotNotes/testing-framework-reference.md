# Testing Framework Reference

Last updated: 2026-03-29

## 1) Purpose

This note captures the agreed testing direction for the `SecondAct` project so that testing setup and implementation can happen in a separate chat thread without losing context.

This is intentionally separate from the backend pipeline build thread.

## 2) Current Decision

We should build a **real testing foundation now**, but we should **not** try to build an extensive, heavy testing system all at once.

The right approach is:

- build the minimum serious testing baseline now
- focus on backend/business-logic protection first
- expand coverage gradually as the product grows

## 3) Why We Are Doing This Now

This project is a financial product, and the backend pipeline will contain deterministic logic that can silently regress if it is not protected by tests.

At the current stage:

- Step 2 created the real schema and Supabase tables
- Step 3 created the contract layer
- next steps will add real business logic

That makes this a good time to set up the testing foundation before the codebase grows further.

## 4) What We Should Build Now

We should add a **pragmatic baseline**, not a full enterprise QA program.

Recommended now:

1. `Vitest` for unit tests and lightweight integration tests
2. test file conventions and folder structure
3. coverage reporting
4. first backend-focused tests
5. keep `Playwright` for end-to-end testing later

## 5) What We Should Not Overbuild Right Now

We should avoid:

1. a huge frontend test suite immediately
2. broad snapshot-heavy UI testing
3. trying to test every component before core backend logic exists
4. building a complex QA framework before the report pipeline is stable

## 6) Recommended Tooling

### Unit / integration layer

- `Vitest`

Why:

- lightweight
- TypeScript-friendly
- fast feedback loop
- good fit for backend modules and utility logic

### End-to-end layer

- `Playwright`

Why:

- already part of project direction
- useful later for full portfolio-to-report and auth/payment/report-download flows

### Optional later additions

- `MSW` for mocking external services cleanly
- test database helpers / fixtures
- API route integration helpers

These are useful, but not required for the first testing pass.

## 7) Highest-Value Tests To Add First

### 1. Contract validation tests

The Step 3 contract layer already has a sanity-check script.

This should evolve into formal tests for:

- market-data contract validation
- canonical snapshot validation
- analysis output validation
- narrative output validation
- final report document validation

### 2. Canonical model builder tests

Given:

- DB holdings
- market-data payload
- reporting/base currency

Verify:

- quantities map correctly
- costs map correctly
- market values are correct
- FX normalization is correct
- portfolio totals are correct
- data quality flags are carried forward correctly

### 3. Analysis engine tests

This is the highest-priority test area.

We should lock:

- total market value
- total cost basis
- unrealized P&L
- portfolio weights
- concentration / HHI
- winners / losers
- stress-test calculations

### 4. Provider normalization tests

Given raw `yfinance` adapter output, verify that our normalized `MarketDataProvider` result shape is correct and stable.

This is important because provider swap later should not change the rest of the system.

### 5. Report assembly tests

Given valid canonical, analysis, and narrative payloads, verify that:

- `ReportDocument` assembles correctly
- system-owned disclaimer is present
- required metadata exists
- renderer input contract validates

## 8) Recommended Test Strategy By Layer

### Layer 1: Unit tests

Use for:

- financial calculations
- data normalization
- analysis logic
- schema validation
- utility functions

### Layer 2: Integration tests

Use for:

- Prisma repository behavior
- orchestration steps
- API route behavior
- queue/job behavior

### Layer 3: End-to-end tests

Use for:

- portfolio to report run flow
- PDF generation flow
- later auth flow
- later payment flow
- later report download/email/save flow

## 9) Current Project Recommendation

The best near-term move is:

1. add `Vitest`
2. create test conventions and base config
3. convert the existing Step 3 contract sanity check into proper tests
4. continue testing new backend modules as they are built

This should be treated as a **testing foundation step**, not a separate giant project.

## 10) Recommended Order Of Work

### Phase A: Foundation

1. install and configure `Vitest`
2. add scripts for running tests and coverage
3. define file naming conventions
4. add one sample passing backend test

### Phase B: Contract and pipeline tests

1. contract schema tests
2. canonical model tests
3. analysis engine tests
4. provider normalization tests
5. report assembly tests

### Phase C: Broader integration coverage

1. repository tests
2. API route tests
3. worker/orchestration tests

### Phase D: End-to-end coverage

1. critical browser flows with Playwright
2. report generation end-to-end
3. auth/payment/download flows later

## 11) Important Principle

The goal is **not** “test everything immediately.”

The goal is:

- create a stable test foundation
- protect critical financial logic early
- make it easy to keep adding tests as the project grows

## 12) Strong Recommendation To Carry Forward

As new backend modules are added, tests should be written either:

- just before implementation for clearly defined deterministic logic
- or immediately alongside implementation

This is especially important for:

- canonical model logic
- analysis engine formulas
- provider normalization
- report assembly

## 13) Summary

Recommended now:

- add a serious but lightweight test foundation
- focus on backend/business logic first
- use `Vitest` now
- keep `Playwright` for later E2E growth

Recommended later:

- broaden integration coverage
- add end-to-end coverage for full product flows
- expand frontend test coverage where it adds real value

## 14) How Another Chat Should Use This Note

If another agent/chat is asked to set up testing, it should use this note as the source of truth and should aim to:

1. keep the setup lightweight
2. prioritize backend pipeline logic
3. avoid overbuilding the testing system
4. preserve the current backend pipeline thread from testing-specific detail
