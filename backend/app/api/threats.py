from __future__ import annotations

import uuid
from collections import defaultdict
from fastapi import APIRouter, HTTPException

from app.api.schemas import ExploitOut, VulnerabilityOut
from app.deps import DBDep, PrincipalDep
from app.models import Exploit, Mutation, Vulnerability

router = APIRouter(prefix="/threats", tags=["threats"])


@router.get("/vulnerabilities", response_model=list[VulnerabilityOut])
def list_vulnerabilities(p: PrincipalDep, db: DBDep) -> list[Vulnerability]:
    return (db.query(Vulnerability)
              .filter(Vulnerability.tenant_id == p.tenant_id,
                      Vulnerability.status != "working")
              .order_by(Vulnerability.severity.desc())
              .limit(200).all())


@router.get("/vulnerabilities/{vuln_id}", response_model=VulnerabilityOut)
def get_vulnerability(vuln_id: uuid.UUID, p: PrincipalDep, db: DBDep) -> Vulnerability:
    v = db.get(Vulnerability, vuln_id)
    if not v or v.tenant_id != p.tenant_id:
        raise HTTPException(status_code=404, detail="vulnerability not found")
    return v


@router.get("/exploits", response_model=list[ExploitOut])
def list_exploits(p: PrincipalDep, db: DBDep, family: str | None = None,
                  only_success: bool = False) -> list[Exploit]:
    q = db.query(Exploit).filter(Exploit.tenant_id == p.tenant_id)
    if family:
        q = q.filter(Exploit.family == family)
    if only_success:
        q = q.filter(Exploit.success.is_(True))
    return q.order_by(Exploit.created_at.desc()).limit(500).all()


@router.get("/genome")
def attack_genome(p: PrincipalDep, db: DBDep) -> dict:
    """Mutation lineage graph for the Genome view."""
    exps = (db.query(Exploit)
              .filter(Exploit.tenant_id == p.tenant_id)
              .order_by(Exploit.created_at.asc())
              .limit(2000).all())
    nodes = [{
        "id": str(e.id), "family": e.family, "generation": e.generation,
        "success": e.success, "score": e.score,
        "dna": e.dna or {},
    } for e in exps]
    edges = [{"source": str(e.parent_id), "target": str(e.id)}
             for e in exps if e.parent_id]
    families: dict[str, int] = defaultdict(int)
    for e in exps:
        families[e.family] += 1
    return {"nodes": nodes, "edges": edges, "families": dict(families)}


@router.get("/intelligence")
def threat_intelligence(p: PrincipalDep, db: DBDep) -> dict:
    """Aggregated threat-intel signal for the dashboard hero strip."""
    # Bound the materialized list: on a tenant with millions of open
    # vulnerabilities this used to load every row into memory just to
    # bucket by family. The aggregation is approximate anyway — we sort
    # by created_at desc so newer signal dominates if we hit the cap.
    vulns = (db.query(Vulnerability)
               .filter(Vulnerability.tenant_id == p.tenant_id,
                       Vulnerability.status == "open")
               .order_by(Vulnerability.created_at.desc())
               .limit(5000).all())
    by_family: dict[str, dict] = {}
    for v in vulns:
        sev = float(v.severity or 0.0)
        bucket = by_family.setdefault(v.family, {
            "family": v.family, "count": 0,
            "max_severity": 0.0, "avg_severity": 0.0, "sum": 0.0,
        })
        bucket["count"] += 1
        bucket["sum"] += sev
        bucket["max_severity"] = max(bucket["max_severity"], sev)
        bucket["avg_severity"] = bucket["sum"] / bucket["count"]
    for b in by_family.values():
        b.pop("sum", None)

    mut_count = db.query(Mutation).join(Exploit, Mutation.child_exploit_id == Exploit.id)\
                  .filter(Exploit.tenant_id == p.tenant_id).count()
    success_count = db.query(Exploit).filter(
        Exploit.tenant_id == p.tenant_id, Exploit.success.is_(True)
    ).count()
    total_exp = db.query(Exploit).filter(Exploit.tenant_id == p.tenant_id).count()

    return {
        "families": sorted(by_family.values(), key=lambda x: -x["max_severity"]),
        "mutations": mut_count,
        "successes": success_count,
        "total_exploits": total_exp,
        "success_rate": (success_count / total_exp) if total_exp else 0.0,
    }
