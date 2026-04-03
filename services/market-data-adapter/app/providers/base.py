from __future__ import annotations

from abc import ABC, abstractmethod

from app.models import MarketDataRequest, MarketSecuritySnapshot


class QuoteProvider(ABC):
    """Provider boundary for fetching and normalizing market data."""

    provider_name: str

    @abstractmethod
    def fetch_securities(
        self, request: MarketDataRequest
    ) -> list[MarketSecuritySnapshot]:
        raise NotImplementedError
