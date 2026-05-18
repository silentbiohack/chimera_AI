"""Coordinated attacker swarm — 6 specialized roles + Strategist coordinator.

Replaces the previous single-attacker model with a role-based ecosystem
where each specialist contributes a distinct slice of the kill chain:

    SCOUT              → reconnaissance enrichment (passive)
    EXPLOIT_ENGINEER   → direct exploit chains (PI, jailbreak, tool abuse)
    DECEPTION          → stealth & obfuscation mutations
    PERSISTENCE        → memory / RAG poisoning for cross-session impact
    EXFILTRATION       → secret discovery + covert-channel attempts
    STRATEGIST         → adaptive role selection per tick (orchestrator)

The Strategist watches the per-role success ledger and shifts weight toward
roles that are succeeding (exploitation) while still firing under-used roles
periodically (exploration). It also evolves the campaign phase over time:
discovery → exploitation → persistence/exfil.
"""
from app.agents.swarm.roles import SwarmRole, ROLE_FAMILIES
from app.agents.swarm.coordinator import Strategist, SwarmTickResult

__all__ = ["SwarmRole", "ROLE_FAMILIES", "Strategist", "SwarmTickResult"]
