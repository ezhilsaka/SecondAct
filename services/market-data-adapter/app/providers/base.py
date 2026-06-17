from __future__ import annotations

from abc import ABC, abstractmethod

from app.models import MarketDataRequest, MarketSecuritySnapshot, SecuritySearchResult


class QuoteProvider(ABC):
    """Provider boundary for fetching and normalizing market data."""

    provider_name: str

    @abstractmethod
    def fetch_securities(
        self, request: MarketDataRequest
    ) -> list[MarketSecuritySnapshot]:
        raise NotImplementedError


class SecuritySearchProvider(ABC):
    """Provider boundary for searching provider-normalized security symbols."""

    provider_name: str

    @abstractmethod
    def search_securities(self, query: str, max_results: int) -> list[SecuritySearchResult]:
        raise NotImplementedError
