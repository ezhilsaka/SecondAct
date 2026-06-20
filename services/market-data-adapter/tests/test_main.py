from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import ServiceSettings
from app.errors import ProviderError, ProviderTimeoutError
from app.main import create_app
from app.models import MarketDataRequest, MarketSecuritySnapshot, SecuritySearchResult, SupportedCurrency
from app.providers.base import QuoteProvider, SecuritySearchProvider


class FakeProvider(QuoteProvider, SecuritySearchProvider):
    provider_name = "fake-provider"

    def __init__(self, mode: str = "success") -> None:
        self.mode = mode

    def fetch_securities(
        self, request: MarketDataRequest
    ) -> list[MarketSecuritySnapshot]:
        if self.mode == "timeout":
            raise ProviderTimeoutError("Timed out")
        if self.mode == "error":
            raise ProviderError("Provider failed")

        return [
            MarketSecuritySnapshot(
                ticker=ticker,
                securityName=f"{ticker} Inc.",
                securityCurrency=SupportedCurrency.USD,
                reportingCurrency=request.reporting_currency,
                currentPrice=None if ticker == "BAD" else "101.00000000",
                fxRateToReportingCurrency=None if ticker == "BAD" else "1.00000000",
                quoteTimestamp=None if ticker == "BAD" else "2026-03-31T00:00:00Z",
                dataQualityFlags=[] if ticker != "BAD" else ["quote_not_found"],
            )
            for ticker in request.tickers
        ]

    def search_securities(self, query: str, max_results: int) -> list[SecuritySearchResult]:
        if self.mode == "timeout":
            raise ProviderTimeoutError("Timed out")
        if self.mode == "error":
            raise ProviderError("Provider failed")

        return [
            SecuritySearchResult(
                symbol="AAPL",
                name="Apple Inc.",
                exchange="NASDAQ",
                region="United States",
                currency=SupportedCurrency.USD,
                matchScore="0.9500",
                provider=self.provider_name,
            ),
            SecuritySearchResult(
                symbol="SHOP.TO",
                name="Shopify Inc.",
                exchange="TSX",
                region="Canada",
                currency=SupportedCurrency.CAD,
                matchScore="0.9100",
                provider=self.provider_name,
            ),
        ][:max_results]


def build_test_client(provider: QuoteProvider, max_tickers: int = 50) -> TestClient:
    app = create_app(
        settings=ServiceSettings(
            max_tickers_per_request=max_tickers,
            internal_api_secret="test-internal-secret",
        ),
        provider=provider,
    )
    return TestClient(app)


def test_health_endpoint_returns_service_status() -> None:
    client = build_test_client(FakeProvider())

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "market-data-adapter",
        "provider": "fake-provider",
    }


def test_quotes_endpoint_returns_normalized_payload() -> None:
    client = build_test_client(FakeProvider())

    response = client.post(
        "/market-data/quotes",
        json={"tickers": [" aapl ", "SHOP.TO", "AAPL"], "reportingCurrency": "USD"},
        headers={"X-Internal-Secret": "test-internal-secret"},
    )

    body = response.json()
    assert response.status_code == 200
    assert body["provider"] == "fake-provider"
    assert body["reportingCurrency"] == "USD"
    assert [security["ticker"] for security in body["securities"]] == ["AAPL", "SHOP.TO"]


def test_quotes_endpoint_returns_400_for_invalid_request() -> None:
    client = build_test_client(FakeProvider())

    response = client.post(
        "/market-data/quotes",
        json={"tickers": [], "reportingCurrency": "USD"},
        headers={"X-Internal-Secret": "test-internal-secret"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


def test_quotes_endpoint_returns_400_for_unsafe_tickers() -> None:
    client = build_test_client(FakeProvider())

    response = client.post(
        "/market-data/quotes",
        json={"tickers": ["AAPL;DROP"], "reportingCurrency": "USD"},
        headers={"X-Internal-Secret": "test-internal-secret"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


def test_quotes_endpoint_keeps_partial_symbol_failures_in_a_200_response() -> None:
    client = build_test_client(FakeProvider())

    response = client.post(
        "/market-data/quotes",
        json={"tickers": ["AAPL", "BAD"], "reportingCurrency": "USD"},
        headers={"X-Internal-Secret": "test-internal-secret"},
    )

    body = response.json()
    assert response.status_code == 200
    assert body["securities"][0]["ticker"] == "AAPL"
    assert body["securities"][0]["currentPrice"] == "101.00000000"
    assert body["securities"][1]["ticker"] == "BAD"
    assert body["securities"][1]["currentPrice"] is None
    assert body["securities"][1]["dataQualityFlags"] == ["quote_not_found"]


def test_quotes_endpoint_returns_400_when_request_exceeds_max_tickers() -> None:
    client = build_test_client(FakeProvider(), max_tickers=1)

    response = client.post(
        "/market-data/quotes",
        json={"tickers": ["AAPL", "SHOP.TO"], "reportingCurrency": "USD"},
        headers={"X-Internal-Secret": "test-internal-secret"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "REQUEST_LIMIT_EXCEEDED"


def test_quotes_endpoint_returns_504_when_provider_times_out() -> None:
    client = build_test_client(FakeProvider(mode="timeout"))

    response = client.post(
        "/market-data/quotes",
        json={"tickers": ["AAPL"], "reportingCurrency": "USD"},
        headers={"X-Internal-Secret": "test-internal-secret"},
    )

    assert response.status_code == 504
    assert response.json()["error"]["code"] == "MARKET_DATA_PROVIDER_TIMEOUT"


def test_quotes_endpoint_returns_502_for_provider_failure() -> None:
    client = build_test_client(FakeProvider(mode="error"))

    response = client.post(
        "/market-data/quotes",
        json={"tickers": ["AAPL"], "reportingCurrency": "USD"},
        headers={"X-Internal-Secret": "test-internal-secret"},
    )

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "MARKET_DATA_PROVIDER_ERROR"


def test_quotes_endpoint_returns_401_when_internal_secret_is_missing() -> None:
    client = build_test_client(FakeProvider())

    response = client.post(
        "/market-data/quotes",
        json={"tickers": ["AAPL"], "reportingCurrency": "USD"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Unauthorized"


def test_quotes_endpoint_returns_401_when_internal_secret_is_invalid() -> None:
    client = build_test_client(FakeProvider())

    response = client.post(
        "/market-data/quotes",
        json={"tickers": ["AAPL"], "reportingCurrency": "USD"},
        headers={"X-Internal-Secret": "wrong-secret"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Unauthorized"


def test_quotes_endpoint_fails_closed_when_internal_secret_is_not_configured() -> None:
    app = create_app(
        settings=ServiceSettings(internal_api_secret=""),
        provider=FakeProvider(),
    )
    client = TestClient(app)

    response = client.post(
        "/market-data/quotes",
        json={"tickers": ["AAPL"], "reportingCurrency": "USD"},
        headers={"X-Internal-Secret": "test-internal-secret"},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Market data adapter internal authentication is not configured."


def test_search_endpoint_returns_normalized_payload() -> None:
    client = build_test_client(FakeProvider())

    response = client.get(
        "/market-data/search",
        params={"query": " Apple  "},
        headers={"X-Internal-Secret": "test-internal-secret"},
    )

    body = response.json()
    assert response.status_code == 200
    assert body["schemaVersion"] == "security-search.v1"
    assert body["provider"] == "fake-provider"
    assert [result["symbol"] for result in body["results"]] == ["AAPL", "SHOP.TO"]
    assert body["results"][0] == {
        "symbol": "AAPL",
        "name": "Apple Inc.",
        "exchange": "NASDAQ",
        "region": "United States",
        "currency": "USD",
        "matchScore": "0.9500",
        "provider": "fake-provider",
    }


def test_search_endpoint_returns_400_for_invalid_query() -> None:
    client = build_test_client(FakeProvider())

    response = client.get(
        "/market-data/search",
        params={"query": "A"},
        headers={"X-Internal-Secret": "test-internal-secret"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_SEARCH_QUERY"


def test_search_endpoint_returns_504_when_provider_times_out() -> None:
    client = build_test_client(FakeProvider(mode="timeout"))

    response = client.get(
        "/market-data/search",
        params={"query": "Apple"},
        headers={"X-Internal-Secret": "test-internal-secret"},
    )

    assert response.status_code == 504
    assert response.json()["error"]["code"] == "MARKET_DATA_PROVIDER_TIMEOUT"


def test_search_endpoint_returns_502_for_provider_failure() -> None:
    client = build_test_client(FakeProvider(mode="error"))

    response = client.get(
        "/market-data/search",
        params={"query": "Apple"},
        headers={"X-Internal-Secret": "test-internal-secret"},
    )

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "MARKET_DATA_PROVIDER_ERROR"


def test_search_endpoint_requires_internal_secret() -> None:
    client = build_test_client(FakeProvider())

    response = client.get("/market-data/search", params={"query": "Apple"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Unauthorized"
