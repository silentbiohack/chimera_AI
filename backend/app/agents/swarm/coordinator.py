"""Strategist — adaptive role selection across the campaign.

The Strategist is the brain of the swarm. On each orchestrator tick it:
  1. Reads the current ledger (per-role attempts / successes / blocks).
  2. Decides which operative to deploy this tick.
  3. Decides whether to *seed* a fresh attack or *evolve* an existing one.
  4. Updates the ledger from the tick result.

Selection policy is a UCB-style bandit (success rate + exploration bonus
for under-used roles) modulated by the campaign phase:

    DISCOVERY      — first ⅓ of the budget. Spread attempts widely so
                     every role generates at least a few candidates.
    EXPLOITATION   — middle ⅓. Concentrate on roles with non-zero success.
                     Lean on the Exploit Engineer if no one has scored yet.
    PERSISTENCE    — last ⅓. Bias toward Persistence + Exfiltration so the
                     campaign closes with long-tail impact, not just IOC
                     count.

This is a small, transparent rule set rather than a full RL loop because
the rest of the platform already exposes the ledger; an operator can
reason about why a role fires when it does.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field

from app.agents.swarm.roles import OPERATIVE_ROLES, SwarmRole


@dataclass
class RoleStats:
    attempts: int = 0
    successes: int = 0
    blocks: int = 0

    @property
    def success_rate(self) -> float:
        return self.successes / self.attempts if self.attempts else 0.0


@dataclass
class SwarmTickResult:
    role: SwarmRole
    action: str  # "seed" | "evolve"
    family: str | None = None
    parent_id: str | None = None


@dataclass
class Strategist:
    rng: random.Random
    budget: int
    # Exploration constant for the UCB bonus. Higher → more spread.
    explore_c: float = 1.4
    ledger: dict[SwarmRole, RoleStats] = field(default_factory=dict)
    tick: int = 0

    def __post_init__(self) -> None:
        for r in OPERATIVE_ROLES:
            self.ledger.setdefault(r, RoleStats())

    # ------------------------------------------------------------------
    # Phase

    def phase(self) -> str:
        if self.budget <= 0:
            return "discovery"
        frac = self.tick / self.budget
        if frac < 1 / 3:
            return "discovery"
        if frac < 2 / 3:
            return "exploitation"
        return "persistence"

    # ------------------------------------------------------------------
    # Selection

    def pick_role(self) -> SwarmRole:
        phase = self.phase()

        # In discovery, every role must get at least 2 attempts before we
        # start weighting — otherwise the first lucky role drowns the rest.
        if phase == "discovery":
            cold = [r for r in OPERATIVE_ROLES if self.ledger[r].attempts < 2]
            if cold:
                return self.rng.choice(cold)

        # Phase bias: when we're in persistence mode, double the weight
        # of long-tail roles so they fire more often even if their
        # current success rate is modest.
        phase_bonus: dict[SwarmRole, float] = {r: 0.0 for r in OPERATIVE_ROLES}
        if phase == "persistence":
            phase_bonus[SwarmRole.PERSISTENCE] = 0.4
            phase_bonus[SwarmRole.EXFILTRATION] = 0.3
        elif phase == "exploitation":
            phase_bonus[SwarmRole.EXPLOIT_ENGINEER] = 0.2

        total_attempts = sum(s.attempts for s in self.ledger.values()) or 1
        scored: list[tuple[float, SwarmRole]] = []
        for role in OPERATIVE_ROLES:
            s = self.ledger[role]
            # UCB-style: exploit rate + exploration bonus for under-tried roles.
            exploration = self.explore_c * math.sqrt(
                math.log(total_attempts + 1) / (s.attempts + 1)
            )
            score = s.success_rate + exploration + phase_bonus[role]
            scored.append((score, role))

        scored.sort(reverse=True)
        # Top-3 with weighted random pick to avoid deterministic streaks.
        top = scored[:3]
        weights = [max(score, 0.01) for score, _ in top]
        choices = [role for _, role in top]
        return self.rng.choices(choices, weights=weights, k=1)[0]

    def pick_action(self, population_size: int) -> str:
        # Always seed early; once we have material to mutate, lean evolve.
        if population_size < len(OPERATIVE_ROLES):
            return "seed"
        # 75% evolve, 25% reseed to keep family diversity.
        return "evolve" if self.rng.random() < 0.75 else "seed"

    # ------------------------------------------------------------------
    # Bookkeeping

    def record(self, role: SwarmRole, *, success: bool, blocked: bool) -> None:
        s = self.ledger[role]
        s.attempts += 1
        if success:
            s.successes += 1
        if blocked:
            s.blocks += 1
        self.tick += 1

    def snapshot(self) -> dict:
        return {
            "phase": self.phase(),
            "tick": self.tick,
            "budget": self.budget,
            "roles": {
                r.value: {
                    "attempts": s.attempts,
                    "successes": s.successes,
                    "blocks": s.blocks,
                    "success_rate": round(s.success_rate, 3),
                }
                for r, s in self.ledger.items()
            },
        }
