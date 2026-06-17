from __future__ import annotations

import re

from app.config import ServiceSettings
from app.errors import InvalidSearchQueryError
from app.models import SecuritySearchResponse, current_timestamp_iso
from app.providers.base import SecuritySearchProvider

SECURITY_SEARCH_SCHEMA_VERSION = "security-search.v1"
SEARCH_QUERY_PATTERN = re.compile(r"^[A-Za-z0-9 .&-]+$")


def normalize_search_query(value: str) -> str:
    return " ".join(value.strip().split())


class SearchService:
    """Coordinates security-search request validation and provider execution."""

    def __init__(self, provider: SecuritySearchProvider, settings: ServiceSettings) -> None:
        self._provider = provider
        self._settings = settings

    @property
    def provider_name(self) -> str:
        return self._provider.provider_name

    def search(self, query: str) -> SecuritySearchResponse:
        normalized_query = normalize_search_query(query)

        if len(normalized_query) < 2:
            raise InvalidSearchQueryError("Search query must be at least 2 characters.")

        if len(normalized_query) > 40:
            raise InvalidSearchQueryError("Search query must be 40 characters or fewer.")

        if not SEARCH_QUERY_PATTERN.fullmatch(normalized_query):
            raise InvalidSearchQueryError(
                "Search query can only contain letters, numbers, spaces, dots, hyphens, and ampersands."
            )

        results = self._provider.search_securities(
            query=normalized_query,
            max_results=self._settings.max_search_results,
        )

        return SecuritySearchResponse(
            schemaVersion=SECURITY_SEARCH_SCHEMA_VERSION,
            provider=self._provider.provider_name,
            requestedAt=current_timestamp_iso(),
            results=results[: self._settings.max_search_results],
        )
