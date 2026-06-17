from __future__ import annotations

import pytest

from app.config import ServiceSettings
from app.errors import InvalidSearchQueryError
from app.models import SecuritySearchResult, SupportedCurrency
from app.providers.base import SecuritySearchProvider
from app.services.search_service import SearchService


class StubSearchProvider(SecuritySearchProvider):
    provider_name = "stub-search"

    def search_securities(self, query: str, max_results: int) -> list[SecuritySearchResult]:
        return [
            SecuritySearchResult(
                symbol=f"TEST{i}",
                name=f"Test {i}",
                exchange="NASDAQ",
                region="United States",
                currency=SupportedCurrency.USD,
                matchScore="0.9000",
                provider=self.provider_name,
            )
            for i in range(max_results + 2)
        ]


def test_search_service_normalizes_query_and_limits_results() -> None:
    service = SearchService(
        provider=StubSearchProvider(),
        settings=ServiceSettings(max_search_results=2),
    )

    response = service.search("  Apple   Inc ")

    assert response.schema_version == "security-search.v1"
    assert response.provider == "stub-search"
    assert [result.symbol for result in response.results] == ["TEST0", "TEST1"]


def test_search_service_rejects_invalid_queries() -> None:
    service = SearchService(provider=StubSearchProvider(), settings=ServiceSettings())

    with pytest.raises(InvalidSearchQueryError):
        service.search("A")

    with pytest.raises(InvalidSearchQueryError):
        service.search("AAPL/USD")
