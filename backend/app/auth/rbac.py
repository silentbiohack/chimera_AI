"""Role-based access control for CHIMERA.

Roles (least → most privileged):
    viewer   — read dashboards
    analyst  — launch attack sessions, view exploits
    operator — manage policies, agents, sandbox
    admin    — tenant-wide: users, billing, audit
    root     — cross-tenant (CHIMERA staff only)
"""
from __future__ import annotations

from enum import Enum
from fastapi import HTTPException, status


class Role(str, Enum):
    VIEWER = "viewer"
    ANALYST = "analyst"
    OPERATOR = "operator"
    ADMIN = "admin"
    ROOT = "root"


_LEVELS: dict[str, int] = {
    Role.VIEWER:   10,
    Role.ANALYST:  20,
    Role.OPERATOR: 30,
    Role.ADMIN:    40,
    Role.ROOT:     99,
}


def can(user_role: str, required: Role) -> bool:
    return _LEVELS.get(user_role, 0) >= _LEVELS[required]


def require(user_role: str, required: Role) -> None:
    if not can(user_role, required):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"role '{user_role}' lacks privilege '{required.value}'",
        )
