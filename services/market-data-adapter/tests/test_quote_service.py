from __future__ import annotations

import pytest

from app.config import ServiceSettings
from app.errors import RequestLimitExceededError
from app.models import MarketDataRequest, MarketSecuritySnapshot, SupportedCurrency
from app.providers.base import QuoteProvider
from app.services.quote_service import QuoteService


class StubProvider(QuoteProvider):
    provider_name = "stub-provider"

    def fetch_securities(
        self, request: MarketDataRequest
    ) -> list[MarketSecuritySnapshot]:
        return [
            MarketSecuritySnapshot(
                ticker=ticker,
                securityName=f"{ticker} Inc.",
                securityCurrency=SupportedCurrency.USD,
                reportingCurrency=request.reporting_currency,
                currentPrice="101.00000000",
                fxRateToReportingCurrency="1.00000000",
                quoteTimestamp="2026-03-31T00:00:00Z",
                dataQualityFlags=[],
            )
            for ticker in request.tickers
        ]


def test_quote_service_wraps_provider_results_in_contract_shape() -> None:
    service = QuoteService(provider=StubProvider(), settings=ServiceSettings())
    request = MarketDataRequest.model_validate(
        {"tickers": [" aapl ", "SHOP.TO", "AAPL"], "reportingCurrency": "USD"}
    )

    response = service.get_quotes(request)

    assert response.schema_version == "market-data.v1"
    assert response.provider == "stub-provider"
    assert [security.ticker for security in response.securities] == ["AAPL", "SHOP.TO"]


def test_quote_service_enforces_max_ticker_limit() -> None:
    service = QuoteService(provider=StubProvider(), settings=ServiceSettings(max_tickers_per_request=1))
    request = MarketDataRequest.model_validate(
        {"tickers": ["AAPL", "SHOP.TO"], "reportingCurrency": "USD"}
    )

    with pytest.raises(RequestLimitExceededError):
        service.get_quotes(request)


def test_market_data_request_rejects_unsafe_tickers() -> None:
    with pytest.raises(ValueError, match="Tickers can only contain"):
        MarketDataRequest.model_validate(
            {"tickers": ["AAPL;DROP"], "reportingCurrency": "USD"}
        )
