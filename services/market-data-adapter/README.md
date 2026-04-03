# Market Data Adapter

Internal FastAPI service for the Phase 1 report pipeline.

## Purpose

This service hides provider-specific market data behavior behind a normalized API contract.
For the current build phase it uses `yfinance`, but the service is structured so the provider can be swapped later.

## Endpoints

- `GET /health`
- `POST /market-data/quotes`

## Local setup

```bash
cd services/market-data-adapter
python3 -m venv .venv
source .venv/bin/activate
pip install .[dev]
```

## Run locally

```bash
cd services/market-data-adapter
source .venv/bin/activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Run tests

```bash
cd services/market-data-adapter
source .venv/bin/activate
pytest
```
