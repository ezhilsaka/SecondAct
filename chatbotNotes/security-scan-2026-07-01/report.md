# Codex Security Scan Results - 2026-07-01

## Why this file exists

The original Codex Security artifact paths were written under macOS temporary storage:

`/private/var/folders/.../codex-security-scans-GTOXDd/...`

Those temp files are no longer present, so the original Markdown report, findings JSON, coverage JSON, and helper artifact script cannot be opened from their previous links. On 2026-07-08, the completed scan record was still recoverable from the Codex Security workspace, so this folder captures a durable repo-visible summary of the result.

Recovered files:

- `report.md` - this human-readable summary.
- `findings-recovered.json` - recovered finding detail from the scan context.
- `coverage-recovered.json` - recovered scan status and coverage counters.

## Scan Verdict

| Field | Value |
| --- | --- |
| Scan status | Complete |
| Scan id | `cda7889c-733d-4890-9756-695d475abbd4` |
| Target revision | `b02a7fd35e2473a493c20a3ee04e8452c333edec` |
| Worklist coverage | 557 / 557 rows closed |
| Reportable findings | 1 |
| Severity mix | 1 medium |

## Finding 1 - Medium / P2

**Title:** Report-run API can enqueue duplicate active reports for the same portfolio

**Summary:** The authenticated `POST /api/v1/report-runs` route bypasses the UI active-run idempotency check and calls `createAndEnqueue` directly. Each call creates a new queued report run and enqueues a Graphile job keyed by the new run id, allowing a normal authenticated user to repeatedly trigger report-generation work for the same owned portfolio.

**Why it matters:** This is not a cross-tenant data leak and it requires authentication, but it can amplify server-side work: market-data calls, narrative provider calls, Playwright PDF rendering, database writes, queue entries, and Supabase Storage writes.

**Severity:** Medium, score 5.4.

**Confidence:** High.

**CWE:** CWE-770 and CWE-400.

## Evidence

### API route directly enqueues

File: `src/app/api/v1/report-runs/route.ts`

Lines: 133-140

```ts
const service = new ReportRunService();
const result = await service.createAndEnqueue({
  userId,
  portfolioId: body.portfolioId,
  reportingCurrency: body.reportingCurrency
});

return NextResponse.json(result, { status: 201 });
```

The route authenticates and validates the body, then calls `createAndEnqueue` directly. It does not first check for an existing queued or processing run.

### Service creates a new queued run

File: `src/server/services/report-run-service.ts`

Lines: 550-565

```ts
async createAndEnqueue(input: CreateReportRunInput): Promise<CreateReportRunResult> {
  const userId = uuidSchema.parse(input.userId);
  const portfolioId = uuidSchema.parse(input.portfolioId);

  const ownsPortfolio = await this.repository.verifyPortfolioOwnership(userId, portfolioId);
  if (!ownsPortfolio) {
    throw new PortfolioNotFoundError("Portfolio not found.");
  }

  const run = await this.repository.createReportRun({
    userId,
    portfolioId,
    reportingCurrency: input.reportingCurrency
  });
```

Ownership is checked, but no active-run/idempotency guard is enforced inside the shared creation path.

### Queue key is per new run id

File: `src/server/services/report-run-service.ts`

Lines: 576-599

```ts
const jobKey = `report-run:${run.id}`;
const maxAttempts = 1;

try {
  await this.jobEnqueuer.enqueue(
    this.env.REPORT_RUN_TASK_IDENTIFIER,
    {
      reportRunId: run.id
    },
    {
      jobKey,
      maxAttempts
    }
  );
```

Because the job key uses the new run id, repeated requests for the same portfolio create different queue keys.

### UI path has the missing guard

File: `src/app/app/reports/actions.ts`

Lines: 111-124

```ts
const activeRun = await service.findActiveReportRunForPortfolio(
  user.id,
  parsedPortfolioId.data
);

if (activeRun) {
  targetRunId = activeRun.runId;
} else {
  const run = await service.createAndEnqueue({
    userId: user.id,
    portfolioId: parsedPortfolioId.data,
    reportingCurrency: parsedReportingCurrency.data
  });
  targetRunId = run.runId;
}
```

The UI server action reuses an active run instead of enqueueing another one. The issue is that this invariant is not centralized where every creation path must obey it.

## Recommended Fix

Move report-run idempotency into the service layer or database transaction used by every creation path.

Recommended shape:

1. Before creating/enqueueing, check for an existing `QUEUED` or `PROCESSING` run for the same `userId` and `portfolioId`.
2. Return that existing run or reject the request with a conflict response.
3. Make the check race-safe with a transaction, advisory lock, or partial unique index for active runs.
4. Add API tests proving repeated `POST /api/v1/report-runs` calls do not create/enqueue a duplicate active run.
5. Add per-user report-generation rate limits before public launch.

## What Was Not Available

The original sealed artifact bundle is gone from temp storage, including the full generated `report.md`, `findings.json`, `coverage.json`, SARIF, and work ledger files. The recovered scan context still confirms:

- The scan completed.
- Coverage closed 557 / 557 rows.
- There was one reportable finding.
- The finding details, evidence, severity, confidence, and remediation text above.

