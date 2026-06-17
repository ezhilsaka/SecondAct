from __future__ import annotations


class MarketDataAdapterError(Exception):
    """Base class for adapter-domain exceptions."""

    error_code = "MARKET_DATA_ADAPTER_ERROR"


class RequestLimitExceededError(MarketDataAdapterError):
    """Raised when a request exceeds the configured ticker limit."""

    error_code = "REQUEST_LIMIT_EXCEEDED"


class InvalidSearchQueryError(MarketDataAdapterError):
    """Raised when a search query does not satisfy adapter rules."""

    error_code = "INVALID_SEARCH_QUERY"


class ProviderError(MarketDataAdapterError):
    """Raised when the upstream provider fails in a non-timeout way."""

    error_code = "MARKET_DATA_PROVIDER_ERROR"


class ProviderTimeoutError(ProviderError):
    """Raised when the upstream provider times out."""

    error_code = "MARKET_DATA_PROVIDER_TIMEOUT"
