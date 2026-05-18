from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

log = logging.getLogger("chimera.lobster_trap")

# Bound payload size before regex evaluation. ReDoS scales superlinearly with
# input length, so capping input puts a hard upper bound on time spent
# matching even for catastrophically backtracking patterns.
_MAX_REGEX_INPUT = 16 * 1024  # 16 KB
# Reject regexes whose source is so long it's almost certainly hostile —
# legitimate detection rules are short. Anything over this is a smell.
_MAX_REGEX_LEN = 512


class Action(str, Enum):
    ALLOW = "allow"
    MONITOR = "monitor"
    REWRITE = "rewrite"
    QUARANTINE = "quarantine"
    BLOCK = "block"


@dataclass
class Verdict:
    action: Action
    matched_rules: list[str] = field(default_factory=list)
    rewritten: str | None = None
    risk: float = 0.0
    reason: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "action": self.action.value,
            "matched_rules": self.matched_rules,
            "rewritten": self.rewritten,
            "risk": round(self.risk, 3),
            "reason": self.reason,
        }


class PolicyEngine:
    """Evaluates a versioned rule_set against an incoming payload.

    rule_set schema (JSON-storable):
        {
          "deny_when_any":     [ {contains_any | matches_regex} , ... ],
          "quarantine_when":   [ ... ],
          "rewrite_when_any":  [ ... ],
          "monitor_when_any":  [ ... ]
        }
    """

    def __init__(self, rule_set: dict[str, Any]) -> None:
        self.rule_set = rule_set or {}
        # Pre-compile regexes once per engine. Bad patterns are silently
        # dropped (with a warning) so one malformed rule can't take down
        # the whole defender. Cached on the engine; instances are short-
        # lived (swapped on policy promotion) so size stays bounded.
        self._compiled: dict[str, re.Pattern[str] | None] = {}
        for bucket in ("deny_when_any", "quarantine_when",
                       "rewrite_when_any", "monitor_when_any"):
            for clause in self.rule_set.get(bucket, []):
                rx = clause.get("matches_regex") if isinstance(clause, dict) else None
                if not isinstance(rx, str) or rx in self._compiled:
                    continue
                if len(rx) > _MAX_REGEX_LEN:
                    log.warning("dropping oversized regex (%d chars)", len(rx))
                    self._compiled[rx] = None
                    continue
                try:
                    self._compiled[rx] = re.compile(rx)
                except re.error as e:
                    log.warning("invalid regex %r: %s", rx, e)
                    self._compiled[rx] = None

    def evaluate(self, payload: str) -> Verdict:
        matched: list[str] = []

        for clause in self.rule_set.get("deny_when_any", []):
            if self._match(clause, payload):
                matched.append(self._label(clause))
                return Verdict(
                    action=Action.BLOCK, matched_rules=matched,
                    risk=0.95, reason="hard-deny rule matched",
                )

        for clause in self.rule_set.get("quarantine_when", []):
            if self._match(clause, payload):
                matched.append(self._label(clause))
                return Verdict(
                    action=Action.QUARANTINE, matched_rules=matched,
                    risk=0.85, reason="quarantine rule matched",
                )

        for clause in self.rule_set.get("rewrite_when_any", []):
            if self._match(clause, payload):
                matched.append(self._label(clause))
                rewritten = self._sanitize(payload)
                return Verdict(
                    action=Action.REWRITE, matched_rules=matched,
                    rewritten=rewritten, risk=0.55,
                    reason="payload sanitized",
                )

        for clause in self.rule_set.get("monitor_when_any", []):
            if self._match(clause, payload):
                matched.append(self._label(clause))
                return Verdict(
                    action=Action.MONITOR, matched_rules=matched,
                    risk=0.30, reason="suspicious — monitored",
                )

        return Verdict(action=Action.ALLOW, risk=0.05)

    # ------------------------------------------------------------------
    def _match(self, clause: dict[str, Any], payload: str) -> bool:
        # Bound input length so worst-case regex time stays predictable.
        # The substring/regex semantics still hold for any payload that
        # would realistically need inspecting; truly long payloads should
        # be rejected at the API boundary.
        capped = payload if len(payload) <= _MAX_REGEX_INPUT else payload[:_MAX_REGEX_INPUT]
        p = capped.lower()
        for word in clause.get("contains_any", []) or []:
            if isinstance(word, str) and word and word.lower() in p:
                return True
        rx = clause.get("matches_regex")
        if isinstance(rx, str):
            pattern = self._compiled.get(rx)
            if pattern is None:
                # Either malformed (logged at __init__) or not pre-compiled
                # because the rule_set was mutated post-construction. Skip
                # rather than re-compile on the hot path.
                return False
            try:
                if pattern.search(capped):
                    return True
            except Exception as e:  # noqa: BLE001 — never let a pattern crash inspection
                log.warning("regex match raised on %r: %s", rx, e)
                return False
        return False

    @staticmethod
    def _label(clause: dict[str, Any]) -> str:
        if "contains_any" in clause:
            return f"contains_any:{','.join(clause['contains_any'][:3])}"
        if "matches_regex" in clause:
            return f"regex:{clause['matches_regex']}"
        return "unknown"

    @staticmethod
    def _sanitize(payload: str) -> str:
        scrubbed = re.sub(
            r"(?i)(api[_\s-]?key|password|secret|token)\s*[:=]\s*\S+",
            r"\1: [REDACTED]", payload,
        )
        scrubbed = re.sub(r"[​-‍﻿]", "", scrubbed)  # zero-width
        return scrubbed
