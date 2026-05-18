"""Swarm role taxonomy + family mapping.

Each attacker role specializes in a subset of attack families. The mapping
is intentionally non-disjoint: families like `tool_abuse` belong primarily
to the Exploit Engineer but the Persistence agent will also reach for
`memory_poison` chained with a tool call. The coordinator uses these sets
to pick a family when a role is activated.
"""
from __future__ import annotations

from enum import Enum


class SwarmRole(str, Enum):
    SCOUT = "scout"
    EXPLOIT_ENGINEER = "exploit_engineer"
    DECEPTION = "deception"
    PERSISTENCE = "persistence"
    EXFILTRATION = "exfiltration"
    STRATEGIST = "strategist"


# Operative roles — the Strategist itself never generates attacks directly.
OPERATIVE_ROLES: tuple[SwarmRole, ...] = (
    SwarmRole.EXPLOIT_ENGINEER,
    SwarmRole.DECEPTION,
    SwarmRole.PERSISTENCE,
    SwarmRole.EXFILTRATION,
)


# Primary families per role. The first entry is the "house" family
# (preferred when seeding); later entries are fallbacks the coordinator
# uses when the house family is already saturated.
ROLE_FAMILIES: dict[SwarmRole, tuple[str, ...]] = {
    SwarmRole.EXPLOIT_ENGINEER: ("prompt_injection", "jailbreak", "tool_abuse"),
    SwarmRole.DECEPTION:        ("jailbreak", "prompt_injection"),
    SwarmRole.PERSISTENCE:      ("memory_poison", "rag_poison"),
    SwarmRole.EXFILTRATION:     ("exfiltration", "tool_abuse", "excessive_agency"),
    # SCOUT and STRATEGIST don't produce attacks directly.
    SwarmRole.SCOUT:            (),
    SwarmRole.STRATEGIST:       (),
}


# Mutation strategy bias — the Deception role prefers obfuscation/embedding,
# Persistence reaches for split-turn so the poisoning instruction reads as a
# pair of innocuous-looking messages. The coordinator passes these as a hint
# to the mutation engine when a role mutates an existing exploit.
ROLE_STRATEGY_BIAS: dict[SwarmRole, tuple[str, ...]] = {
    SwarmRole.EXPLOIT_ENGINEER: ("escalate", "chain"),
    SwarmRole.DECEPTION:        ("obfuscate", "rephrase", "split_turn"),
    SwarmRole.PERSISTENCE:      ("embed_rag", "split_turn"),
    SwarmRole.EXFILTRATION:     ("obfuscate", "chain"),
    SwarmRole.SCOUT:            (),
    SwarmRole.STRATEGIST:       (),
}
