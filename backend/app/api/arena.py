from __future__ import annotations

import logging
import uuid
from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from sqlalchemy import Integer, cast, func

from app.api.schemas import AttackSessionOut, ExploitOut, StartAttackIn
from app.auth.rbac import Role, require
from app.deps import DBDep, PrincipalDep
from app.models import Agent, AttackSession, AuditLog, Exploit

log = logging.getLogger("chimera.api.arena")
router = APIRouter(prefix="/arena", tags=["arena"])


@router.post("/sessions", response_model=AttackSessionOut, status_code=status.HTTP_201_CREATED)
def start_session(
    body: StartAttackIn,
    p: PrincipalDep,
    db: DBDep,
    background: BackgroundTasks,
) -> AttackSession:
    require(p.role, Role.ANALYST)
    agent = db.get(Agent, body.target_agent_id)
    if not agent or agent.tenant_id != p.tenant_id:
        raise HTTPException(status_code=404, detail="target agent not found")

    sess = AttackSession(
        tenant_id=p.tenant_id, target_agent_id=agent.id,
        status="queued", objective=body.objective,
    )
    db.add(sess)
    db.flush()  # populate sess.id before audit log references it

    db.add(AuditLog(
        tenant_id=p.tenant_id, user_id=p.user_id,
        action="arena.start", resource="attack_session",
        resource_id=str(sess.id), payload=body.model_dump(mode="json"),
    ))
    db.commit()
    db.refresh(sess)

    _dispatch(sess.id, background)
    return sess


def _dispatch(session_id: uuid.UUID, background: BackgroundTasks) -> None:
    """Prefer the Redis-backed worker; if it's unreachable, fall back to an
    in-process BackgroundTask so the demo still completes."""
    try:
        from app.workers import queue as q
        q.enqueue("arena.run_session", {"session_id": str(session_id)})
        return
    except Exception:
        log.warning("redis enqueue failed — running session in-process")

    async def _inproc() -> None:
        from app.agents.orchestrator import run_session
        try:
            await run_session(session_id)
        except Exception:
            log.exception("inproc orchestrator failed session=%s", session_id)

    background.add_task(_inproc)


@router.get("/sessions", response_model=list[AttackSessionOut])
def list_sessions(p: PrincipalDep, db: DBDep) -> list[AttackSession]:
    return (db.query(AttackSession)
              .filter(AttackSession.tenant_id == p.tenant_id)
              .order_by(AttackSession.created_at.desc())
              .limit(100).all())


@router.get("/sessions/{session_id}", response_model=AttackSessionOut)
def get_session(session_id: uuid.UUID, p: PrincipalDep, db: DBDep) -> AttackSession:
    s = db.get(AttackSession, session_id)
    if not s or s.tenant_id != p.tenant_id:
        raise HTTPException(status_code=404, detail="session not found")
    return s


@router.get("/sessions/{session_id}/exploits", response_model=list[ExploitOut])
def list_session_exploits(session_id: uuid.UUID, p: PrincipalDep, db: DBDep) -> list[Exploit]:
    s = db.get(AttackSession, session_id)
    if not s or s.tenant_id != p.tenant_id:
        raise HTTPException(status_code=404, detail="session not found")
    # Hard cap: a long session can produce thousands of exploits and the
    # frontend graph saturates well before that. Caller can paginate later.
    return (db.query(Exploit)
              .filter(Exploit.session_id == session_id)
              .order_by(Exploit.created_at.asc())
              .limit(2000).all())


@router.get("/sessions/{session_id}/swarm")
def session_swarm(session_id: uuid.UUID, p: PrincipalDep, db: DBDep) -> dict:
    """Per-role contribution breakdown for the swarm panel.

    Aggregated server-side via group-by so the UI can render the panel
    with one cheap query instead of pulling every exploit row.
    """
    s = db.get(AttackSession, session_id)
    if not s or s.tenant_id != p.tenant_id:
        raise HTTPException(status_code=404, detail="session not found")

    rows = (
        db.query(
            Exploit.role,
            func.count(Exploit.id).label("attempts"),
            func.sum(cast(Exploit.success, Integer)).label("successes"),
        )
        .filter(Exploit.session_id == session_id)
        .group_by(Exploit.role)
        .all()
    )
    breakdown = []
    for role, attempts, successes in rows:
        a = int(attempts or 0)
        succ = int(successes or 0)
        breakdown.append({
            "role": role or "unknown",
            "attempts": a,
            "successes": succ,
            "success_rate": round(succ / a, 3) if a else 0.0,
        })
    breakdown.sort(key=lambda r: r["attempts"], reverse=True)
    return {
        "session_id": str(session_id),
        "status": s.status,
        "snapshot": (s.details or {}).get("swarm"),
        "roles": breakdown,
    }
