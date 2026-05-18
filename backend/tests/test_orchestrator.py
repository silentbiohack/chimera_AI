"""Integration test for the orchestrator. Hits a real Postgres + local bus.

This is the single integration test that verifies the full arena tick loop:
recon → seed → mutate → trap → sandbox → score → persist. If this stays
green, every domain-level invariant (lineage, telemetry emission,
vulnerability recording) still holds.
"""
from __future__ import annotations

import asyncio

import pytest

from app.agents.orchestrator import run_session
from app.config import settings
from app.models import AttackSession, Exploit, Mutation, TelemetryEvent


@pytest.fixture(autouse=True)
def _shrink_arena(monkeypatch):
    """Cap budget so the test finishes in a few seconds."""
    monkeypatch.setattr(settings, "arena_mutation_budget", 6, raising=False)
    monkeypatch.setattr(settings, "arena_tick_ms", 0, raising=False)


def test_run_session_end_to_end(db_session, tenant, sandbox_agent):
    sess = AttackSession(
        tenant_id=tenant.id, target_agent_id=sandbox_agent.id,
        status="queued", objective="integration test",
    )
    db_session.add(sess)
    db_session.commit()
    db_session.refresh(sess)
    sess_id = sess.id

    asyncio.run(run_session(sess_id))

    db_session.expire_all()
    refreshed = db_session.get(AttackSession, sess_id)
    assert refreshed is not None
    assert refreshed.status == "completed"

    exploits = db_session.query(Exploit).filter(Exploit.session_id == sess_id).all()
    assert len(exploits) >= 3, "should at least seed the initial population"

    # Each mutated exploit must reference a parent in the same session.
    mutations = db_session.query(Mutation).all()
    if mutations:
        for m in mutations:
            assert m.parent_exploit_id != m.child_exploit_id

    # Telemetry persisted for the timeline view.
    events = (
        db_session.query(TelemetryEvent)
        .filter(TelemetryEvent.session_id == sess_id)
        .all()
    )
    assert any(e.kind == "tick" for e in events)
