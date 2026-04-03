from __future__ import annotations

from app.config import ServiceSettings
from app.errors import RequestLimitExceededError
from app.models import MarketDataRequest, MarketDataResponse
from app.providers.base import QuoteProvider

MARKET_DATA_SCHEMA_VERSION = "market-data.v1"


class QuoteService:
    """Coordinates request validation rules and provider execution."""

    def __init__(self, provider: QuoteProvider, settings: ServiceSettings) -> None:
        self._provider = provider
        self._settings = settings

    @property
    def provider_name(self) -> str:
        return self._provider.provider_name

    def get_quotes(self, request: MarketDataRequest) -> MarketDataResponse:
        if len(request.tickers) > self._settings.max_tickers_per_request:
            raise RequestLimitExceededError(
                f"A maximum of {self._settings.max_tickers_per_request} tickers is allowed per request."
            )

        securities = self._provider.fetch_securities(request)

        return MarketDataResponse(
            schemaVersion=MARKET_DATA_SCHEMA_VERSION,
            provider=self._provider.provider_name,
            requestedAt=request.requested_at_iso(),
            reportingCurrency=request.reporting_currency,
            securities=securities,
        )
