"""Domain errors and FastAPI exception handlers for the response envelope."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from schemas.envelope import error_body


class AppError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
    ) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__("not_found", message, status_code=404)


class ConflictError(AppError):
    def __init__(self, message: str = "Conflict") -> None:
        super().__init__("conflict", message, status_code=409)


class ValidationAppError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__("validation_error", message, status_code=400)


def _detail_to_error(detail: Any) -> tuple[str, str]:
    if isinstance(detail, dict) and "code" in detail and "message" in detail:
        return str(detail["code"]), str(detail["message"])
    if isinstance(detail, str):
        return "http_error", detail
    return "http_error", "Request failed"


def register_exception_handlers(app: FastAPI) -> None:
    # Local import: avoids a module-load-time circular import, since the
    # `ai` package's __init__ imports ai.embed, which imports this module
    # (root `errors`) for AppError. By the time this function runs (from
    # main.py, after both modules have finished loading), the cycle is gone.
    from ai.errors import ProviderError

    @app.exception_handler(AppError)
    async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body(exc.code, exc.message),
        )

    @app.exception_handler(ProviderError)
    async def provider_error_handler(
        _request: Request, exc: ProviderError
    ) -> JSONResponse:
        # Module 3's typed failure surface, translated to the API envelope.
        # Scoring (Module 5) and future AI-calling modules rely on this so
        # a failed call surfaces as a clear per-item error, never a bare 500.
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body(
                "provider_error", f"{exc.provider}/{exc.capability}: {exc.message}"
            ),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        errors = exc.errors()
        if errors:
            first = errors[0]
            loc = ".".join(str(p) for p in first.get("loc", ()) if p != "body")
            msg = first.get("msg", "Invalid request")
            message = f"{loc}: {msg}" if loc else str(msg)
        else:
            message = "Invalid request"
        return JSONResponse(
            status_code=400,
            content=error_body("validation_error", message),
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(
        _request: Request, exc: HTTPException
    ) -> JSONResponse:
        code, message = _detail_to_error(exc.detail)
        if exc.status_code == 401 and code == "http_error":
            code = "unauthorized"
        elif exc.status_code == 404 and code == "http_error":
            code = "not_found"
        elif exc.status_code == 409 and code == "http_error":
            code = "conflict"
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body(code, message),
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(Exception)
    async def unhandled_handler(_request: Request, exc: Exception) -> JSONResponse:
        # Avoid leaking internals; log in real deployments.
        return JSONResponse(
            status_code=500,
            content=error_body("internal_error", "An unexpected error occurred"),
        )
