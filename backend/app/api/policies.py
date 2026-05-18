from __future__ import annotations

import uuid
from typing import Any
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import case

# Mirror the lobster_trap regex input cap so payloads bigger than the
# inspector will ever look at are rejected at the API boundary.
_MAX_INSPECT_PAYLOAD = 16 * 1024
_MAX_POLICY_NAME = 128

from app.api.schemas import PolicyOut
from app.auth.rbac import Role, require
from app.deps import DBDep, PrincipalDep
from app.lobster_trap import PolicyEngine
from app.models import AuditLog, Policy

router = APIRouter(prefix="/policies", tags=["policies"])


class PolicyIn(BaseModel):
    name: str = Field(min_length=1, max_length=_MAX_POLICY_NAME)
    rule_set: dict[str, Any]


class InspectIn(BaseModel):
    payload: str = Field(max_length=_MAX_INSPECT_PAYLOAD)
    policy_id: uuid.UUID | None = None


@router.get("", response_model=list[PolicyOut])
def list_policies(p: PrincipalDep, db: DBDep) -> list[Policy]:
    return (db.query(Policy)
              .filter(Policy.tenant_id == p.tenant_id)
              .order_by(Policy.version.desc()).all())


@router.post("", response_model=PolicyOut, status_code=status.HTTP_201_CREATED)
def create_policy(body: PolicyIn, p: PrincipalDep, db: DBDep) -> Policy:
    require(p.role, Role.OPERATOR)
    latest = (db.query(Policy)
                .filter(Policy.tenant_id == p.tenant_id, Policy.name == body.name)
                .order_by(Policy.version.desc()).first())
    next_v = (latest.version + 1) if latest else 1
    if latest:
        latest.active = False
    pol = Policy(tenant_id=p.tenant_id, name=body.name, version=next_v,
                 rule_set=body.rule_set, active=True, auto_generated=False)
    db.add(pol)
    db.flush()  # populate pol.id

    db.add(AuditLog(tenant_id=p.tenant_id, user_id=p.user_id,
                    action="policy.create", resource="policy",
                    resource_id=str(pol.id), payload=body.model_dump(mode="json")))
    db.commit()
    db.refresh(pol)
    return pol


@router.post("/{policy_id}/activate", response_model=PolicyOut)
def activate_policy(policy_id: uuid.UUID, p: PrincipalDep, db: DBDep) -> Policy:
    require(p.role, Role.OPERATOR)
    pol = db.get(Policy, policy_id)
    if not pol or pol.tenant_id != p.tenant_id:
        raise HTTPException(status_code=404, detail="policy not found")
    # Atomic flip: a single UPDATE that activates the target and deactivates
    # every other version of the same policy name. Avoids a TOCTOU window
    # where two concurrent activations could both succeed and leave two
    # policies marked active (or none, depending on commit ordering).
    db.query(Policy).filter(
        Policy.tenant_id == p.tenant_id,
        Policy.name == pol.name,
    ).update(
        {Policy.active: case((Policy.id == pol.id, True), else_=False)},
        synchronize_session=False,
    )
    db.commit()
    db.refresh(pol)
    return pol


@router.post("/inspect")
async def inspect(body: InspectIn, p: PrincipalDep, db: DBDep) -> dict:
    if body.policy_id:
        pol = db.get(Policy, body.policy_id)
        if not pol or pol.tenant_id != p.tenant_id:
            raise HTTPException(status_code=404, detail="policy not found")
        rules = pol.rule_set
    else:
        pol = (db.query(Policy)
                 .filter(Policy.tenant_id == p.tenant_id, Policy.active.is_(True))
                 .order_by(Policy.version.desc()).first())
        rules = pol.rule_set if pol else {}
    engine = PolicyEngine(rules)
    return engine.evaluate(body.payload).to_dict()
