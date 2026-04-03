from __future__ import annotations

import logging
import secrets
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.config import ServiceSettings, get_settings
from app.errors import (
    ProviderError,
    ProviderTimeoutError,
    RequestLimitExceededError,
)
from app.models import ErrorDetail, ErrorPayload, ErrorResponse, HealthResponse, MarketDataRequest
from app.providers.base import QuoteProvider
from app.providers.yfinance_client import YFinanceProvider
from app.services.quote_service import QuoteService

logger = logging.getLogger(__name__)


def verify_internal_secret(
    request: Request,
    x_internal_secret: Optional[str] = Header(default=None, alias="X-Internal-Secret"),
) -> None:
    expected_secret = request.app.state.settings.internal_api_secret

    if not expected_secret:
        logger.error("Market data adapter internal API secret is not configured.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Market data adapter internal authentication is not configured.",
        )

    provided_secret = x_internal_secret or ""
    if not secrets.compare_digest(provided_secret, expected_secret):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")


def build_provider(settings: ServiceSettings) -> QuoteProvider:
    if settings.provider_name == "yfinance":
        return YFinanceProvider(settings=settings)

    raise ValueError(f"Unsupported provider configured: {settings.provider_name}")


def create_app(
    settings: Optional[ServiceSettings] = None, provider: Optional[QuoteProvider] = None
) -> FastAPI:
    resolved_settings = settings or get_settings()
    resolved_provider = provider or build_provider(resolved_settings)
    quote_service = QuoteService(provider=resolved_provider, settings=resolved_settings)

    app = FastAPI(title="SecondAct Market Data Adapter", version="0.1.0")
    app.state.settings = resolved_settings
    app.state.quote_service = quote_service

    @app.exception_handler(RequestValidationError)
    async def handle_request_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details = [
            ErrorDetail(field=".".join(map(str, error["loc"])), message=error["msg"])
            for error in exc.errors()
        ]
        response = ErrorResponse(
            error=ErrorPayload(
                code="INVALID_REQUEST",
                message="Request validation failed.",
                details=details,
            )
        )
        return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=response.model_dump())

    @app.exception_handler(RequestLimitExceededError)
    async def handle_request_limit_error(
        request: Request, exc: RequestLimitExceededError
    ) -> JSONResponse:
        response = ErrorResponse(
            error=ErrorPayload(code=exc.error_code, message=str(exc), details=[])
        )
        return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=response.model_dump())

    @app.exception_handler(ProviderTimeoutError)
    async def handle_provider_timeout(
        request: Request, exc: ProviderTimeoutError
    ) -> JSONResponse:
        logger.warning("Market data provider timed out: %s", exc)
        response = ErrorResponse(
            error=ErrorPayload(
                code=exc.error_code,
                message="Market data provider timed out while fetching quotes.",
                details=[],
            )
        )
        return JSONResponse(status_code=status.HTTP_504_GATEWAY_TIMEOUT, content=response.model_dump())

    @app.exception_handler(ProviderError)
    async def handle_provider_error(request: Request, exc: ProviderError) -> JSONResponse:
        logger.warning("Market data provider error: %s", exc)
        response = ErrorResponse(
            error=ErrorPayload(
                code=exc.error_code,
                message="Market data provider failed while fetching quotes.",
                details=[],
            )
        )
        return JSONResponse(status_code=status.HTTP_502_BAD_GATEWAY, content=response.model_dump())

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unexpected market data adapter error", exc_info=exc)
        response = ErrorResponse(
            error=ErrorPayload(
                code="INTERNAL_SERVER_ERROR",
                message="Unexpected internal error while fetching market data.",
                details=[],
            )
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=response.model_dump()
        )

    @app.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(
            status="ok",
            service=resolved_settings.service_name,
            provider=quote_service.provider_name,
        )

    @app.post("/market-data/quotes", dependencies=[Depends(verify_internal_secret)])
    def quotes(payload: MarketDataRequest):
        return quote_service.get_quotes(payload)

    return app


app = create_app()
