from __future__ import annotations

from app.config import ServiceSettings
from app.models import MarketDataRequest
from app.providers.yfinance_client import YFinanceProvider


class FakeTicker:
    def __init__(self, info: dict, fast_info: dict) -> None:
        self.info = info
        self.fast_info = fast_info


class FakeSearch:
    def __init__(
        self,
        query: str,
        max_results: int = 8,
        **kwargs,
    ) -> None:
        self.query = query
        self.max_results = max_results
        self.quotes = [
            {
                "symbol": "aapl",
                "shortname": "Apple Inc.",
                "exchDisp": "NASDAQ",
                "region": "United States",
                "currency": "USD",
                "quoteType": "EQUITY",
                "score": 0.95,
                "regularMarketPrice": 214.12,
            },
            {
                "symbol": "SHOP.TO",
                "shortname": "Shopify Inc.",
                "exchDisp": "TSX",
                "region": "Canada",
                "currency": "CAD",
                "quoteType": "EQUITY",
                "score": 0.91,
            },
            {
                "symbol": "BTC-USD",
                "shortname": "Bitcoin USD",
                "quoteType": "CRYPTOCURRENCY",
                "currency": "USD",
            },
            {
                "symbol": "ASML.AS",
                "shortname": "ASML Holding",
                "quoteType": "EQUITY",
                "currency": "EUR",
            },
            {
                "symbol": "AAPL",
                "shortname": "Apple Duplicate",
                "quoteType": "EQUITY",
                "currency": "USD",
            },
        ]


def build_fake_factory() -> dict[str, FakeTicker]:
    mapping = {
        "AAPL": FakeTicker(
            info={
                "currency": "USD",
                "shortName": "Apple Inc.",
                "exchange": "NASDAQ",
                "sector": "Technology",
                "industry": "Consumer Electronics",
                "country": "United States",
                "regularMarketTime": 1711843200,
            },
            fast_info={"lastPrice": 214.12, "previousClose": 213.5, "marketCap": 3120000000000},
        ),
        "SHOP.TO": FakeTicker(
            info={
                "currency": "CAD",
                "shortName": "Shopify Inc.",
                "exchange": "TSX",
                "sector": "Technology",
                "industry": "Software - Application",
                "country": "Canada",
                "regularMarketTime": 1711843200,
            },
            fast_info={"lastPrice": 117.42, "previousClose": 116.01, "marketCap": 150000000000},
        ),
        "CADUSD=X": FakeTicker(info={"currency": "USD"}, fast_info={"lastPrice": 0.72}),
        "ASML": FakeTicker(
            info={
                "currency": "EUR",
                "shortName": "ASML Holding N.V.",
                "exchange": "NASDAQ",
                "sector": "Technology",
                "industry": "Semiconductor Equipment & Materials",
                "country": "Netherlands",
                "regularMarketTime": 1711843200,
            },
            fast_info={"lastPrice": 1012.44, "previousClose": 1008.11, "marketCap": 410000000000},
        ),
        "BAD": FakeTicker(info={}, fast_info={}),
    }
    return mapping


def test_yfinance_provider_returns_fx_rate_for_cross_currency_security() -> None:
    fake_mapping = build_fake_factory()
    provider = YFinanceProvider(
        settings=ServiceSettings(request_timeout_seconds=0.1),
        ticker_factory=lambda symbol: fake_mapping[symbol],
    )
    request = MarketDataRequest.model_validate(
        {"tickers": ["SHOP.TO"], "reportingCurrency": "USD"}
    )

    response = provider.fetch_securities(request)

    assert response[0].ticker == "SHOP.TO"
    assert response[0].security_currency.value == "CAD"
    assert response[0].fx_rate_to_reporting_currency == "0.72000000"


def test_yfinance_provider_returns_placeholder_flags_for_missing_quote_data() -> None:
    fake_mapping = build_fake_factory()
    provider = YFinanceProvider(
        settings=ServiceSettings(request_timeout_seconds=0.1),
        ticker_factory=lambda symbol: fake_mapping[symbol],
    )
    request = MarketDataRequest.model_validate({"tickers": ["BAD"], "reportingCurrency": "USD"})

    response = provider.fetch_securities(request)

    assert response[0].current_price is None
    assert "quote_not_found" in response[0].data_quality_flags
    assert "metadata_missing" in response[0].data_quality_flags


def test_yfinance_provider_does_not_fake_same_currency_fx_for_unsupported_currencies() -> None:
    fake_mapping = build_fake_factory()
    provider = YFinanceProvider(
        settings=ServiceSettings(request_timeout_seconds=0.1),
        ticker_factory=lambda symbol: fake_mapping[symbol],
    )
    request = MarketDataRequest.model_validate({"tickers": ["ASML"], "reportingCurrency": "USD"})

    response = provider.fetch_securities(request)

    assert response[0].ticker == "ASML"
    assert response[0].current_price == "1012.44000000"
    assert response[0].fx_rate_to_reporting_currency is None
    assert "unsupported_security_currency" in response[0].data_quality_flags
    assert "fx_rate_unavailable" in response[0].data_quality_flags


def test_yfinance_provider_returns_normalized_security_search_results() -> None:
    provider = YFinanceProvider(
        settings=ServiceSettings(request_timeout_seconds=0.1),
        search_factory=FakeSearch,
    )

    results = provider.search_securities(query="Apple", max_results=8)

    assert [result.symbol for result in results] == ["AAPL", "SHOP.TO"]
    assert results[0].name == "Apple Inc."
    assert results[0].exchange == "NASDAQ"
    assert results[0].region == "United States"
    assert results[0].currency == "USD"
    assert results[0].match_score == "0.9500"
    assert results[0].provider == "yfinance"
    assert not hasattr(results[0], "regularMarketPrice")


def test_yfinance_provider_limits_security_search_results() -> None:
    provider = YFinanceProvider(
        settings=ServiceSettings(request_timeout_seconds=0.1),
        search_factory=FakeSearch,
    )

    results = provider.search_securities(query="Apple", max_results=1)

    assert [result.symbol for result in results] == ["AAPL"]
