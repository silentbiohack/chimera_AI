from __future__ import annotations

import uuid
from fastapi import APIRouter, HTTPException, Response, status

from app.api.schemas import AgentIn, AgentOut
from app.auth.rbac import Role, require
from app.deps import DBDep, PrincipalDep
from app.models import Agent, AuditLog
from app.sandbox.targets import SANDBOX_TEMPLATES

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("/templates")
def list_templates(_: PrincipalDep) -> list[dict]:
    return [{"name": t["name"], "kind": t["kind"], "tools": t["tools"],
             "permissions": t["permissions"]} for t in SANDBOX_TEMPLATES]


@router.get("", response_model=list[AgentOut])
def list_agents(p: PrincipalDep, db: DBDep) -> list[Agent]:
    return db.query(Agent).filter(Agent.tenant_id == p.tenant_id).all()


@router.post("", response_model=AgentOut, status_code=status.HTTP_201_CREATED)
def create_agent(body: AgentIn, p: PrincipalDep, db: DBDep) -> Agent:
    require(p.role, Role.OPERATOR)
    agent = Agent(tenant_id=p.tenant_id, **body.model_dump())
    db.add(agent)
    db.flush()  # populate agent.id

    db.add(AuditLog(
        tenant_id=p.tenant_id, user_id=p.user_id,
        action="agent.create", resource="agent",
        resource_id=str(agent.id), payload=body.model_dump(mode="json"),
    ))
    db.commit()
    db.refresh(agent)
    return agent


@router.post("/seed-sandbox", response_model=list[AgentOut])
def seed_sandbox(p: PrincipalDep, db: DBDep) -> list[Agent]:
    """One-click: create the canonical synthetic enterprise estate for a tenant."""
    require(p.role, Role.OPERATOR)
    created: list[Agent] = []
    for t in SANDBOX_TEMPLATES:
        existing = db.query(Agent).filter(
            Agent.tenant_id == p.tenant_id, Agent.name == t["name"]
        ).first()
        if existing:
            continue
        a = Agent(
            tenant_id=p.tenant_id,
            name=t["name"], kind=t["kind"],
            description=f"synthetic {t['kind']} agent",
            system_prompt=t["system_prompt"],
            tools=t["tools"], permissions=t["permissions"],
        )
        db.add(a)
        created.append(a)
    db.commit()
    for a in created:
        db.refresh(a)
    return created


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_agent(agent_id: uuid.UUID, p: PrincipalDep, db: DBDep):
    require(p.role, Role.ADMIN)
    a = db.get(Agent, agent_id)
    if not a or a.tenant_id != p.tenant_id:
        raise HTTPException(status_code=404, detail="agent not found")
    db.delete(a)
    db.add(AuditLog(tenant_id=p.tenant_id, user_id=p.user_id,
                    action="agent.delete", resource="agent", resource_id=str(agent_id)))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
