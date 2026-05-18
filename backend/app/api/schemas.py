from __future__ import annotations

import os
import re
import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel, EmailStr, Field, field_validator


_PW_LETTER = re.compile(r"[A-Za-z]")
_PW_DIGIT = re.compile(r"\d")
_DEV_MODE = os.getenv("ENVIRONMENT", "development").lower() != "production"
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _validate_password(v: str) -> str:
    if _DEV_MODE:
        if len(v) < 4:
            raise ValueError("password must be at least 4 characters")
        return v
    if len(v) < 12:
        raise ValueError("password must be at least 12 characters")
    if not _PW_LETTER.search(v) or not _PW_DIGIT.search(v):
        raise ValueError("password must contain both letters and digits")
    return v


def _validate_email(v: str) -> str:
    if not _EMAIL_RE.match(v):
        raise ValueError("not a valid email address")
    return v


# In dev mode, accept any well-formed email (including .test / .example TLDs
# which RFC-strict EmailStr rejects). In prod, enforce strict validation.
EmailField = str if _DEV_MODE else EmailStr


class TenantOut(BaseModel):
    id: uuid.UUID
    name: str
    plan: str
    class Config: from_attributes = True


class RegisterIn(BaseModel):
    tenant_name: str = Field(min_length=2, max_length=128)
    email: EmailField = Field(max_length=320)  # type: ignore[valid-type]
    password: str = Field(max_length=256)

    @field_validator("email")
    @classmethod
    def _em(cls, v: str) -> str:
        return _validate_email(v) if _DEV_MODE else v

    @field_validator("password")
    @classmethod
    def _pw(cls, v: str) -> str:
        return _validate_password(v)


class LoginIn(BaseModel):
    tenant_name: str = Field(min_length=2, max_length=128)
    email: EmailField = Field(max_length=320)  # type: ignore[valid-type]
    password: str = Field(max_length=256)

    @field_validator("email")
    @classmethod
    def _em(cls, v: str) -> str:
        return _validate_email(v) if _DEV_MODE else v


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    tenant_id: uuid.UUID
    user_id: uuid.UUID


class AgentIn(BaseModel):
    name: str = Field(min_length=1, max_length=256)
    kind: str = Field(min_length=1, max_length=64)
    description: str | None = Field(default=None, max_length=4096)
    system_prompt: str | None = Field(default=None, max_length=32_000)
    tools: list[Any] = Field(default_factory=list, max_length=128)
    permissions: list[Any] = Field(default_factory=list, max_length=128)


class AgentOut(AgentIn):
    id: uuid.UUID
    tenant_id: uuid.UUID
    risk_baseline: float
    created_at: datetime
    class Config: from_attributes = True


class StartAttackIn(BaseModel):
    target_agent_id: uuid.UUID
    objective: str | None = Field(default=None, max_length=2048)


class AttackSessionOut(BaseModel):
    id: uuid.UUID
    target_agent_id: uuid.UUID
    status: str
    success: bool
    score: float
    objective: str | None
    started_at: datetime | None
    ended_at: datetime | None
    details: dict[str, Any] = {}
    class Config: from_attributes = True


class VulnerabilityOut(BaseModel):
    id: uuid.UUID
    agent_id: uuid.UUID
    family: str
    title: str
    description: str | None
    severity: float
    exploitability: float
    blast_radius: float
    business_impact: float
    status: str
    evidence: dict[str, Any]
    created_at: datetime
    class Config: from_attributes = True


class ExploitOut(BaseModel):
    id: uuid.UUID
    parent_id: uuid.UUID | None
    session_id: uuid.UUID | None
    family: str
    generation: int
    payload: str
    dna: dict[str, Any]
    success: bool
    score: float
    role: str | None = None
    created_at: datetime
    class Config: from_attributes = True


class PolicyOut(BaseModel):
    id: uuid.UUID
    name: str
    version: int
    rule_set: dict[str, Any]
    active: bool
    auto_generated: bool
    created_at: datetime
    class Config: from_attributes = True
