"""Operative role implementations.

Each operative wraps the existing `attacker.seed_attack` / `attacker.evolve`
call but biases the family selection and (when mutating) the strategy. The
generated `AttackCandidate` is tagged with the producing role so the UI can
colour-code nodes and the coordinator can update its ledger.
"""
from __future__ import annotations

import random
from dataclasses import dataclass

from app.agents import attacker as atk
from app.agents.mutation_engine import fingerprint_payload, mutate
from app.agents.recon import ReconReport
from app.agents.swarm.roles import ROLE_FAMILIES, ROLE_STRATEGY_BIAS, SwarmRole


@dataclass
class RoledCandidate:
    """An AttackCandidate plus the role that produced it."""
    candidate: atk.AttackCandidate
    role: SwarmRole


def seed_for_role(role: SwarmRole, report: ReconReport,
                  rng: random.Random) -> RoledCandidate:
    """Pick the role's house family and call the underlying seed_attack.

    If recon suggested a family the role specializes in, prefer that;
    otherwise fall back to the role's primary family.
    """
    families = ROLE_FAMILIES.get(role, ())
    if not families:
        raise ValueError(f"role {role} cannot seed attacks")
    recon_set = set(report.priority_families or [])
    overlap = [f for f in families if f in recon_set]
    family = overlap[0] if overlap else families[0]
    cand = atk.seed_attack(report, family=family)
    return RoledCandidate(candidate=cand, role=role)


def evolve_for_role(role: SwarmRole, parent: atk.AttackCandidate,
                    rng: random.Random) -> RoledCandidate:
    """Mutate `parent` with a strategy biased toward the role's playbook.

    We don't *force* the strategy (the LLM may rewrite to a different one),
    but we seed the mutation prompt with the bias so a Deception agent
    leans on obfuscation rather than escalation, etc.
    """
    bias = ROLE_STRATEGY_BIAS.get(role) or ()
    if bias:
        # Bias by replacing the mutation engine's RNG-driven choice with a
        # focused sub-RNG that picks from `bias` first. Implementation:
        # pre-select payload via the engine's strategies that match the
        # bias, then fall back to engine default if none apply.
        new_payload, strategy = _biased_mutate(parent, bias, rng)
    else:
        new_payload, strategy = mutate(parent.payload, family=parent.family, rng=rng)

    cand = atk.AttackCandidate(
        family=parent.family,
        payload=new_payload,
        rationale=f"{role.value} mutation via {strategy} (gen {parent.generation})",
        expected_signal=parent.expected_signal,
        dna=fingerprint_payload(new_payload),
        generation=parent.generation + 1,
        parent_payload=parent.payload,
    )
    return RoledCandidate(candidate=cand, role=role)


def _biased_mutate(parent: atk.AttackCandidate, bias: tuple[str, ...],
                   rng: random.Random) -> tuple[str, str]:
    """Try the biased strategies once each; fall back to default mutate."""
    # Use a sub-RNG so the bias attempt doesn't poison the outer RNG state
    # if the user wants reproducible runs (sess.id-seeded).
    for strategy_attempt in bias:
        sub = random.Random(rng.random())
        # Drive the engine's strategy choice by exhausting attempts until
        # the engine happens to pick the biased strategy. Cheap & correct
        # because the engine picks from a small tuple uniformly.
        for _ in range(8):
            new_payload, picked = mutate(parent.payload, family=parent.family, rng=sub)
            if picked == strategy_attempt:
                return new_payload, picked
    # Bias didn't land in the budget — accept whatever the engine returns.
    return mutate(parent.payload, family=parent.family, rng=rng)
