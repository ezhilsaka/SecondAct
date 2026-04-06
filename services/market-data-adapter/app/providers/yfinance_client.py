from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from typing import Any, Callable, Dict, Optional

import yfinance as yf

from app.config import ServiceSettings
from app.errors import ProviderError, ProviderTimeoutError
from app.models import MarketDataRequest, MarketSecuritySnapshot, SupportedCurrency, to_decimal_string, to_iso_timestamp
from app.providers.base import QuoteProvider

SUPPORTED_CURRENCIES = {currency.value for currency in SupportedCurrency}
FX_PAIR_MAP: dict[tuple[SupportedCurrency, SupportedCurrency], str] = {
    (SupportedCurrency.CAD, SupportedCurrency.USD): "CADUSD=X",
    (SupportedCurrency.USD, SupportedCurrency.CAD): "USDCAD=X",
}
DEFAULT_FAILURE_FLAGS = ["quote_not_found", "metadata_missing"]


class YFinanceProvider(QuoteProvider):
    """Yahoo Finance-backed provider that returns provider-neutral snapshots."""

    provider_name = "yfinance"

    def __init__(
        self,
        settings: ServiceSettings,
        ticker_factory: Callable[[str], Any] = yf.Ticker,
    ) -> None:
        self._settings = settings
        self._ticker_factory = ticker_factory

    def fetch_securities(
        self, request: MarketDataRequest
    ) -> list[MarketSecuritySnapshot]:
        return [
            self._fetch_single_security(ticker=ticker, reporting_currency=request.reporting_currency)
            for ticker in request.tickers
        ]

    def _fetch_single_security(
        self, ticker: str, reporting_currency: SupportedCurrency
    ) -> MarketSecuritySnapshot:
        try:
            payload = self._run_with_timeout(lambda: self._load_ticker_payload(ticker))
        except ProviderTimeoutError:
            return self._build_placeholder_snapshot(
                ticker=ticker,
                reporting_currency=reporting_currency,
                flags=["provider_timeout"] + DEFAULT_FAILURE_FLAGS,
            )
        except ProviderError:
            return self._build_placeholder_snapshot(
                ticker=ticker,
                reporting_currency=reporting_currency,
                flags=["provider_error"] + DEFAULT_FAILURE_FLAGS,
            )

        info = payload["info"]
        fast_info = payload["fast_info"]
        data_quality_flags: list[str] = []

        security_currency, currency_is_supported = self._resolve_currency(
            ticker=ticker,
            raw_currency=info.get("currency") or fast_info.get("currency"),
            reporting_currency=reporting_currency,
            data_quality_flags=data_quality_flags,
        )

        current_price = to_decimal_string(
            fast_info.get("lastPrice")
            or fast_info.get("regularMarketPrice")
            or info.get("currentPrice")
            or info.get("regularMarketPrice")
        )
        previous_close = to_decimal_string(
            fast_info.get("previousClose") or info.get("previousClose")
        )
        market_cap = to_decimal_string(
            fast_info.get("marketCap") or info.get("marketCap")
        )
        quote_timestamp = to_iso_timestamp(
            info.get("regularMarketTime") or fast_info.get("lastPriceTime")
        )

        if current_price is None:
            data_quality_flags.append("quote_not_found")
        if not self._has_metadata(info):
            data_quality_flags.append("metadata_missing")

        if currency_is_supported:
            fx_rate = self._resolve_fx_rate(
                security_currency=security_currency,
                reporting_currency=reporting_currency,
                data_quality_flags=data_quality_flags,
            )
        else:
            data_quality_flags.append("fx_rate_unavailable")
            fx_rate = None

        return MarketSecuritySnapshot(
            ticker=ticker,
            securityName=info.get("shortName") or info.get("longName") or info.get("displayName"),
            securityCurrency=security_currency,
            reportingCurrency=reporting_currency,
            currentPrice=current_price,
            fxRateToReportingCurrency=fx_rate,
            quoteTimestamp=quote_timestamp,
            exchange=info.get("exchange") or info.get("fullExchangeName"),
            sector=info.get("sector"),
            industry=info.get("industry"),
            country=info.get("country"),
            marketCap=market_cap,
            previousClose=previous_close,
            dataQualityFlags=self._dedupe_flags(data_quality_flags),
        )

    def _resolve_fx_rate(
        self,
        security_currency: SupportedCurrency,
        reporting_currency: SupportedCurrency,
        data_quality_flags: list[str],
    ) -> Optional[str]:
        if security_currency == reporting_currency:
            return "1.00000000"

        pair_symbol = FX_PAIR_MAP.get((security_currency, reporting_currency))
        if not pair_symbol:
            data_quality_flags.append("fx_rate_unavailable")
            return None

        try:
            fx_payload = self._run_with_timeout(lambda: self._load_ticker_payload(pair_symbol))
        except ProviderError:
            data_quality_flags.append("fx_rate_unavailable")
            return None

        fx_fast_info = fx_payload["fast_info"]
        fx_info = fx_payload["info"]
        fx_value = to_decimal_string(
            fx_fast_info.get("lastPrice")
            or fx_fast_info.get("regularMarketPrice")
            or fx_info.get("currentPrice")
            or fx_info.get("regularMarketPrice")
        )
        if fx_value is None:
            data_quality_flags.append("fx_rate_unavailable")
        return fx_value

    def _load_ticker_payload(self, ticker: str) -> Dict[str, Dict[str, Any]]:
        try:
            ticker_client = self._ticker_factory(ticker)
            info = dict(getattr(ticker_client, "info", {}) or {})
            fast_info = dict(getattr(ticker_client, "fast_info", {}) or {})
            return {"info": info, "fast_info": fast_info}
        except Exception as exc:  # pragma: no cover - defensive guard
            raise ProviderError(f"Failed to load Yahoo Finance payload for {ticker}.") from exc

    def _run_with_timeout(self, operation: Callable[[], Dict[str, Dict[str, Any]]]) -> Dict[str, Dict[str, Any]]:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(operation)
            try:
                return future.result(timeout=self._settings.request_timeout_seconds)
            except FutureTimeoutError as exc:
                raise ProviderTimeoutError("Upstream provider call timed out.") from exc
            except ProviderError:
                raise
            except Exception as exc:
                raise ProviderError("Unexpected upstream provider failure.") from exc

    def _resolve_currency(
        self,
        ticker: str,
        raw_currency: Any,
        reporting_currency: SupportedCurrency,
        data_quality_flags: list[str],
    ) -> tuple[SupportedCurrency, bool]:
        normalized_currency = str(raw_currency).upper() if raw_currency else ""
        if normalized_currency in SUPPORTED_CURRENCIES:
            return SupportedCurrency(normalized_currency), True
        if ticker.endswith(".TO"):
            data_quality_flags.append("currency_inferred_from_symbol")
            return SupportedCurrency.CAD, True
        data_quality_flags.append("unsupported_security_currency")
        return reporting_currency, False

    @staticmethod
    def _has_metadata(info: Dict[str, Any]) -> bool:
        return any(
            info.get(field)
            for field in ("shortName", "longName", "displayName", "exchange", "sector", "industry")
        )

    @staticmethod
    def _dedupe_flags(flags: list[str]) -> list[str]:
        seen: set[str] = set()
        deduped: list[str] = []
        for flag in flags:
            if flag not in seen:
                seen.add(flag)
                deduped.append(flag)
        return deduped

    @staticmethod
    def _build_placeholder_snapshot(
        ticker: str,
        reporting_currency: SupportedCurrency,
        flags: list[str],
    ) -> MarketSecuritySnapshot:
        return MarketSecuritySnapshot(
            ticker=ticker,
            securityName=None,
            securityCurrency=reporting_currency,
            reportingCurrency=reporting_currency,
            currentPrice=None,
            fxRateToReportingCurrency=None,
            quoteTimestamp=None,
            exchange=None,
            sector=None,
            industry=None,
            country=None,
            marketCap=None,
            previousClose=None,
            dataQualityFlags=flags,
        )
