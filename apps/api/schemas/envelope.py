"""Consistent API response envelope for all product routes."""

from __future__ import annotations

from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ApiErrorBody(BaseModel):
    code: str
    message: str


class SuccessResponse(BaseModel, Generic[T]):
    ok: bool = True
    data: T
    error: None = None


class ErrorResponse(BaseModel):
    ok: bool = False
    data: None = None
    error: ApiErrorBody


def ok_response(data: Any) -> dict[str, Any]:
    return {"ok": True, "data": data, "error": None}


def error_body(code: str, message: str) -> dict[str, Any]:
    return {
        "ok": False,
        "data": None,
        "error": {"code": code, "message": message},
    }
