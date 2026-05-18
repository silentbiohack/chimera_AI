"""Executive & technical reporting endpoints."""
from __future__ import annotations

import uuid
from fastapi import APIRouter, HTTPException

from app.deps import DBDep, PrincipalDep
from app.models import (
    Agent, AttackSession, Exploit, Mutation, Policy,
    TelemetryEvent, Vulnerability,
)

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/executive")
def executive(p: PrincipalDep, db: DBDep) -> dict:
    sessions = db.query(AttackSession).filter(AttackSession.tenant_id == p.tenant_id).count()
    successful = db.query(AttackSession).filter(
        AttackSession.tenant_id == p.tenant_id, AttackSession.success.is_(True)
    ).count()
    vulns_open = db.query(Vulnerability).filter(
        Vulnerability.tenant_id == p.tenant_id, Vulnerability.status == "open"
    ).count()
    critical = db.query(Vulnerability).filter(
        Vulnerability.tenant_id == p.tenant_id,
        Vulnerability.severity >= 0.8, Vulnerability.status == "open",
    ).count()
    policies_active = db.query(Policy).filter(
        Policy.tenant_id == p.tenant_id, Policy.active.is_(True)
    ).count()
    auto_policies = db.query(Policy).filter(
        Policy.tenant_id == p.tenant_id, Policy.auto_generated.is_(True)
    ).count()
    agents = db.query(Agent).filter(Agent.tenant_id == p.tenant_id).count()

    return {
        "attack_sessions": sessions,
        "successful_breaches": successful,
        "breach_rate": (successful / sessions) if sessions else 0.0,
        "open_vulnerabilities": vulns_open,
        "critical_vulnerabilities": critical,
        "active_policies": policies_active,
        "auto_generated_policies": auto_policies,
        "agents_under_protection": agents,
        "headline": _headline(critical, auto_policies),
    }


def _headline(critical: int, auto_policies: int) -> str:
    if critical == 0 and auto_policies > 0:
        return "Defense converged — no open criticals; CHIMERA adapted autonomously."
    if critical > 0:
        return f"{critical} critical exposures across the AI agent estate require attention."
    return "Continuous adversarial validation active. No critical exposures."


@router.get("/sessions/{session_id}/timeline")
def session_timeline(session_id: uuid.UUID, p: PrincipalDep, db: DBDep) -> dict:
    sess = db.get(AttackSession, session_id)
    if not sess or sess.tenant_id != p.tenant_id:
        raise HTTPException(status_code=404, detail="session not found")
    events = (db.query(TelemetryEvent)
                .filter(TelemetryEvent.session_id == session_id)
                .order_by(TelemetryEvent.ts.asc())
                .limit(2000).all())
    return {
        "session_id": str(sess.id),
        "status": sess.status,
        "events": [{
            "ts": e.ts.isoformat() if e.ts else None,
            "source": e.source, "kind": e.kind,
            "severity": e.severity, "payload": e.payload,
        } for e in events],
    }
