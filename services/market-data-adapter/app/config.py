from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class ServiceSettings:
    """Runtime settings for the market data adapter service."""

    service_name: str = "market-data-adapter"
    provider_name: str = "yfinance"
    internal_api_secret: str = ""
    host: str = "127.0.0.1"
    port: int = 8000
    request_timeout_seconds: float = 10.0
    max_tickers_per_request: int = 50
    max_retries: int = 1


@lru_cache(maxsize=1)
def get_settings() -> ServiceSettings:
    return ServiceSettings(
        service_name=os.getenv("MARKET_DATA_ADAPTER_SERVICE_NAME", "market-data-adapter"),
        provider_name=os.getenv("MARKET_DATA_ADAPTER_PROVIDER", "yfinance"),
        internal_api_secret=os.getenv("MARKET_DATA_ADAPTER_INTERNAL_API_SECRET", "").strip(),
        host=os.getenv("MARKET_DATA_ADAPTER_HOST", "127.0.0.1"),
        port=int(os.getenv("MARKET_DATA_ADAPTER_PORT", "8000")),
        request_timeout_seconds=float(
            os.getenv("MARKET_DATA_ADAPTER_REQUEST_TIMEOUT_SECONDS", "10")
        ),
        max_tickers_per_request=int(os.getenv("MARKET_DATA_ADAPTER_MAX_TICKERS", "50")),
        max_retries=int(os.getenv("MARKET_DATA_ADAPTER_MAX_RETRIES", "1")),
    )
