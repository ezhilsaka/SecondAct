# Market Data Adapter

Internal FastAPI service for the Phase 1 report pipeline.

## Purpose

This service hides provider-specific market data behavior behind a normalized API contract.
For the current build phase it uses `yfinance`, but the service is structured so the provider can be swapped later.

## Endpoints

- `GET /health`
- `POST /market-data/quotes`
- `GET /market-data/search?query=<text>`

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
export MARKET_DATA_ADAPTER_INTERNAL_API_SECRET="replace-with-long-random-secret"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Run tests

```bash
cd services/market-data-adapter
source .venv/bin/activate
pytest
```

## Authenticated local quote request

`/market-data/quotes` and `/market-data/search` are protected with an internal shared secret. Send the same value you used in `MARKET_DATA_ADAPTER_INTERNAL_API_SECRET` as the `X-Internal-Secret` header:

```bash
curl -X POST http://127.0.0.1:8000/market-data/quotes \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: replace-with-long-random-secret" \
  -d '{"tickers":["AAPL","SHOP.TO"],"reportingCurrency":"USD"}'
```

## Authenticated local symbol search request

```bash
curl "http://127.0.0.1:8000/market-data/search?query=Apple" \
  -H "X-Internal-Secret: replace-with-long-random-secret"
```
