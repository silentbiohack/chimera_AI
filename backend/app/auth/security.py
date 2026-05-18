from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

log = logging.getLogger("chimera.auth")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_MIN_SECRET_BYTES = 32
_WEAK_SECRET_WARNED = False


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _check_secret_strength() -> None:
    """Hard-fail in production if JWT_SECRET is weak, warn once in dev.

    Config does the same check at boot, but that runs against the value
    present at import time. This second guard catches the case where
    settings have been monkey-patched in tests or hot-reloaded.
    """
    global _WEAK_SECRET_WARNED
    s = settings.jwt_secret or ""
    weak = len(s) < _MIN_SECRET_BYTES or s == "dev-secret-change-me"
    if not weak:
        return
    if settings.environment == "production":
        raise RuntimeError(
            "JWT_SECRET is weak (<32 bytes or default) — refusing to mint tokens"
        )
    if not _WEAK_SECRET_WARNED:
        log.warning("JWT_SECRET is weak (dev only) — DO NOT ship to production")
        _WEAK_SECRET_WARNED = True


def create_access_token(claims: dict[str, Any], minutes: int | None = None) -> str:
    _check_secret_strength()
    to_encode = claims.copy()
    now = datetime.now(timezone.utc)
    to_encode.update({
        "exp": now + timedelta(minutes=minutes or settings.jwt_expire_minutes),
        "iat": now,
    })
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as e:
        raise ValueError(f"invalid token: {e}") from e
