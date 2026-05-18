from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.api.schemas import LoginIn, RegisterIn, TokenOut
from app.auth.security import create_access_token, hash_password, verify_password
from app.config import settings
from app.deps import DBDep, PrincipalDep
from app.models import AuditLog, Tenant, User

log = logging.getLogger("chimera.api.auth")


def _is_dev() -> bool:
    # Re-check at call time (not import time) so settings reload / test
    # monkey-patching takes effect. Single source of truth: settings.
    return settings.environment.lower() != "production"


class WsToken(BaseModel):
    token: str
    expires_in: int

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut)
def register(body: RegisterIn, db: DBDep) -> TokenOut:
    # First user of a tenant becomes admin. Tenant name must be unique.
    existing_tenant = db.query(Tenant).filter(Tenant.name == body.tenant_name).first()
    if existing_tenant:
        if not _is_dev():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="tenant already exists — login instead",
            )
        # Dev convenience: idempotent provision. If the user already exists with
        # matching credentials, return a token. If the email is new for this
        # tenant, attach a fresh admin user. Otherwise the password is wrong.
        log.warning(
            "dev-mode register: attaching/returning user for existing tenant "
            "%r — NEVER reachable when ENVIRONMENT=production",
            body.tenant_name,
        )
        existing_user = (
            db.query(User)
            .filter(User.tenant_id == existing_tenant.id, User.email == body.email)
            .first()
        )
        if existing_user:
            if not verify_password(body.password, existing_user.hashed_password):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="user exists in tenant but password does not match",
                )
            token = create_access_token({
                "sub": str(existing_user.id),
                "tid": str(existing_tenant.id),
                "role": existing_user.role,
            })
            return TokenOut(access_token=token, role=existing_user.role,
                            tenant_id=existing_tenant.id, user_id=existing_user.id)
        new_user = User(
            tenant_id=existing_tenant.id, email=body.email,
            hashed_password=hash_password(body.password),
            role="admin", is_active=True,
        )
        db.add(new_user)
        db.flush()
        db.add(AuditLog(
            tenant_id=existing_tenant.id, user_id=new_user.id,
            action="user.register", resource="user", resource_id=str(new_user.id),
            payload={"email": body.email, "tenant_name": body.tenant_name, "dev_attach": True},
        ))
        db.commit()
        token = create_access_token({
            "sub": str(new_user.id),
            "tid": str(existing_tenant.id),
            "role": new_user.role,
        })
        return TokenOut(access_token=token, role=new_user.role,
                        tenant_id=existing_tenant.id, user_id=new_user.id)
    tenant = Tenant(name=body.tenant_name, plan="trial")
    db.add(tenant)
    db.flush()  # populate tenant.id

    user = User(
        tenant_id=tenant.id, email=body.email,
        hashed_password=hash_password(body.password),
        role="admin", is_active=True,
    )
    db.add(user)
    db.flush()  # populate user.id before audit log references it

    db.add(AuditLog(
        tenant_id=tenant.id, user_id=user.id,
        action="user.register", resource="user", resource_id=str(user.id),
        payload={"email": body.email, "tenant_name": body.tenant_name},
    ))
    db.commit()

    token = create_access_token({"sub": str(user.id), "tid": str(tenant.id), "role": user.role})
    return TokenOut(access_token=token, role=user.role,
                    tenant_id=tenant.id, user_id=user.id)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: DBDep) -> TokenOut:
    # Email is unique only within a tenant, so we must scope by tenant.
    user = (
        db.query(User)
        .join(Tenant, User.tenant_id == Tenant.id)
        .filter(
            Tenant.name == body.tenant_name,
            User.email == body.email,
            User.is_active.is_(True),
        )
        .first()
    )
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid credentials")
    token = create_access_token({"sub": str(user.id), "tid": str(user.tenant_id), "role": user.role})
    return TokenOut(access_token=token, role=user.role,
                    tenant_id=user.tenant_id, user_id=user.id)


@router.post("/ws-token", response_model=WsToken)
def issue_ws_token(p: PrincipalDep) -> WsToken:
    """Mint a short-lived JWT specifically for WebSocket auth.

    The main bearer token has a 60-minute lifetime and ends up in the WS
    handshake URL (which can be logged by proxies). A 5-minute, scope-tagged
    token contains the same claims but its blast radius if leaked is bounded.
    """
    minutes = settings.ws_token_expire_minutes
    token = create_access_token(
        {"sub": str(p.user_id), "tid": str(p.tenant_id), "role": p.role, "scope": "ws"},
        minutes=minutes,
    )
    return WsToken(token=token, expires_in=minutes * 60)
