from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.security import decode_token
from app.db import get_db
from app.models import User


@dataclass
class Principal:
    user_id: uuid.UUID
    tenant_id: uuid.UUID
    role: str
    email: str


def get_principal(
    authorization: Annotated[str | None, Header()] = None,
    db: Session = Depends(get_db),
) -> Principal:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        claims = decode_token(token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e)) from e

    user_id = uuid.UUID(claims["sub"])
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="inactive user")
    return Principal(
        user_id=user.id, tenant_id=user.tenant_id, role=user.role, email=user.email
    )


PrincipalDep = Annotated[Principal, Depends(get_principal)]
DBDep = Annotated[Session, Depends(get_db)]
