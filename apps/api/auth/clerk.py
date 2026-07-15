"""Per-request Clerk session JWT verification."""

from __future__ import annotations

import base64
import os
import time
from typing import Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

_bearer = HTTPBearer(auto_error=False)

_jwks_client: PyJWKClient | None = None
_jwks_fetched_at: float = 0.0
_JWKS_TTL_SECONDS = 3600.0


def _frontend_api_from_publishable_key(key: str) -> str | None:
    """Decode Clerk publishable key → frontend API host (e.g. foo.clerk.accounts.dev)."""
    try:
        raw = key.strip()
        if not raw.startswith(("pk_test_", "pk_live_")):
            return None
        b64 = raw.split("_", 2)[-1]
        # Pad base64 if needed
        padded = b64 + "=" * (-len(b64) % 4)
        decoded = base64.b64decode(padded).decode("utf-8").rstrip("$")
        return decoded or None
    except Exception:
        return None


def _clerk_issuer() -> str:
    explicit = os.environ.get("CLERK_JWT_ISSUER", "").strip().rstrip("/")
    if explicit:
        return explicit

    jwks = os.environ.get("CLERK_JWKS_URL", "").strip()
    if jwks and "/.well-known/jwks.json" in jwks:
        return jwks.replace("/.well-known/jwks.json", "")

    pk = os.environ.get("CLERK_PUBLISHABLE_KEY", "").strip()
    if pk:
        host = _frontend_api_from_publishable_key(pk)
        if host:
            return f"https://{host}"

    raise RuntimeError(
        "Missing Clerk issuer: set CLERK_JWT_ISSUER "
        "(e.g. https://xxx.clerk.accounts.dev), CLERK_JWKS_URL, "
        "or CLERK_PUBLISHABLE_KEY."
    )


def _jwks_url() -> str:
    explicit = os.environ.get("CLERK_JWKS_URL", "").strip()
    if explicit:
        return explicit
    return f"{_clerk_issuer()}/.well-known/jwks.json"


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client, _jwks_fetched_at
    now = time.time()
    if _jwks_client is None or (now - _jwks_fetched_at) > _JWKS_TTL_SECONDS:
        _jwks_client = PyJWKClient(_jwks_url(), cache_keys=True)
        _jwks_fetched_at = now
    return _jwks_client


def _unauthorized(message: str = "Missing or invalid Clerk session") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": "unauthorized", "message": message},
        headers={"WWW-Authenticate": "Bearer"},
    )


def verify_clerk_token(token: str) -> dict[str, Any]:
    try:
        client = _get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=_clerk_issuer(),
            options={"require": ["exp", "sub", "iss"]},
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "auth_misconfigured", "message": str(exc)},
        ) from None
    except Exception:
        raise _unauthorized() from None

    sub = payload.get("sub")
    if not sub or not isinstance(sub, str):
        raise _unauthorized("Token missing subject")
    return payload


async def require_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized()
    payload = verify_clerk_token(credentials.credentials)
    return str(payload["sub"])
