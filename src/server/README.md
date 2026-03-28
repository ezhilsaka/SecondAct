# Server Module Layout

`src/server` is the home for backend-only modules that support the report pipeline.

## Current structure

- `config/`: runtime environment parsing and server-only configuration
- `contracts/`: typed contracts shared across pipeline stages
- `modules/`: feature modules such as report runs and portfolio orchestration
- `orchestrators/`: long-running coordination logic for report generation
- `providers/`: external integrations such as market data and narrative adapters
- `queue/`: worker registration and job execution entry points
- `renderers/`: artifact generation such as PDF rendering
- `shared/`: backend-only helpers that should not leak into UI code

This keeps the App Router UI under `src/app` and server implementation details under a single, extractable boundary.
