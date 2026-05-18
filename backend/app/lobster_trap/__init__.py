"""Lobster Trap — inspection, policy enforcement, quarantine.

Inspired by Veea's Lobster Trap concept: a transparent enforcement layer that
sits between any AI agent and its inputs/outputs, inspects every message,
applies a versioned rule-set, and quarantines or rewrites offending traffic.

CHIMERA *uses* the trap as its central defense substrate. Defender agents
auto-generate new rule-sets that get versioned, A/B-tested in the arena, and
promoted to active policy when they win.
"""
from app.lobster_trap.policy_engine import PolicyEngine, Verdict
from app.lobster_trap.inspector import Inspector

__all__ = ["PolicyEngine", "Verdict", "Inspector"]
