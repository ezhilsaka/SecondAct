from __future__ import annotations

import re
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

DECIMAL_PATTERN = r"^-?(0|[1-9]\d*)(\.\d+)?$"
TICKER_PATTERN = re.compile(r"^[A-Z0-9.-]{1,15}$")


class SupportedCurrency(str, Enum):
    USD = "USD"
    CAD = "CAD"


class AssetClass(str, Enum):
    EQUITY = "EQUITY"


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str = "ok"
    service: str
    provider: str


class ErrorDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field: str
    message: str


class ErrorPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    message: str
    details: list[ErrorDetail] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    error: ErrorPayload


class MarketDataRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tickers: list[str] = Field(min_length=1)
    reporting_currency: SupportedCurrency = Field(alias="reportingCurrency")

    @field_validator("tickers")
    @classmethod
    def normalize_tickers(cls, value: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()

        for raw_ticker in value:
            cleaned = raw_ticker.strip().upper()
            if not cleaned:
                continue
            if not TICKER_PATTERN.fullmatch(cleaned):
                raise ValueError(
                    "Tickers can only contain letters, numbers, dots, and hyphens, "
                    "up to 15 characters."
                )
            if cleaned in seen:
                continue
            seen.add(cleaned)
            normalized.append(cleaned)

        if not normalized:
            raise ValueError("At least one valid ticker is required.")

        return normalized

    def requested_at_iso(self) -> str:
        return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class MarketSecuritySnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ticker: str
    security_name: Optional[str] = Field(alias="securityName", default=None)
    asset_class: AssetClass = Field(alias="assetClass", default=AssetClass.EQUITY)
    security_currency: SupportedCurrency = Field(alias="securityCurrency")
    reporting_currency: SupportedCurrency = Field(alias="reportingCurrency")
    current_price: Optional[str] = Field(alias="currentPrice", default=None, pattern=DECIMAL_PATTERN)
    fx_rate_to_reporting_currency: Optional[str] = Field(
        alias="fxRateToReportingCurrency", default=None, pattern=DECIMAL_PATTERN
    )
    quote_timestamp: Optional[str] = Field(alias="quoteTimestamp", default=None)
    data_quality_flags: list[str] = Field(alias="dataQualityFlags", default_factory=list)
    exchange: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    market_cap: Optional[str] = Field(alias="marketCap", default=None, pattern=DECIMAL_PATTERN)
    previous_close: Optional[str] = Field(alias="previousClose", default=None, pattern=DECIMAL_PATTERN)


class MarketDataResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: str = Field(alias="schemaVersion")
    provider: str
    requested_at: str = Field(alias="requestedAt")
    reporting_currency: SupportedCurrency = Field(alias="reportingCurrency")
    securities: list[MarketSecuritySnapshot]


class SecuritySearchResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    symbol: str
    name: Optional[str] = None
    exchange: Optional[str] = None
    region: Optional[str] = None
    currency: Optional[SupportedCurrency] = None
    match_score: Optional[str] = Field(alias="matchScore", default=None, pattern=DECIMAL_PATTERN)
    provider: str


class SecuritySearchResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: str = Field(alias="schemaVersion")
    provider: str
    requested_at: str = Field(alias="requestedAt")
    results: list[SecuritySearchResult]


def current_timestamp_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def to_decimal_string(value: Any, places: str = "0.00000001") -> Optional[str]:
    if value is None or value == "":
        return None

    try:
        decimal_value = Decimal(str(value))
    except Exception:
        return None

    quantized = decimal_value.quantize(Decimal(places))
    return format(quantized, "f")


def to_iso_timestamp(value: Any) -> Optional[str]:
    if value is None or value == "":
        return None

    if isinstance(value, datetime):
        dt_value = value.astimezone(timezone.utc)
        return dt_value.isoformat().replace("+00:00", "Z")

    if isinstance(value, (int, float)):
        dt_value = datetime.fromtimestamp(value, tz=timezone.utc)
        return dt_value.isoformat().replace("+00:00", "Z")

    return None
