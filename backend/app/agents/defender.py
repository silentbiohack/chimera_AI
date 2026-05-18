"""Defender swarm — classification + adaptive policy synthesis."""
from __future__ import annotations

import json
from dataclasses import dataclass

from app.agents._utils import safe_json
from app.agents.llm import llm


@dataclass
class Classification:
    family: str
    confidence: float
    reasoning: str
    recommended_action: str


def classify(payload: str) -> Classification:
    prompt = (
        "ROLE: defender\n"
        "TASK: classify\n"
        f"PAYLOAD: {payload}\n"
        "Return JSON {family, confidence, reasoning, recommended_action}."
    )
    resp = llm.complete(prompt, fast=True, temperature=0.2)
    data = safe_json(resp.text)
    try:
        confidence = float(data.get("confidence", 0.0))
    except (TypeError, ValueError):
        confidence = 0.0
    return Classification(
        family=data.get("family", "unknown"),
        confidence=max(0.0, min(1.0, confidence)),
        reasoning=data.get("reasoning", ""),
        recommended_action=data.get("recommended_action", "monitor"),
    )


def synthesize_policy(family: str, examples: list[str]) -> dict:
    """Defender autonomously proposes a new rule_set patch."""
    prompt = (
        "ROLE: defender\n"
        "TASK: synthesize_policy\n"
        f"FAMILY: {family}\n"
        f"EXAMPLES: {json.dumps(examples[:5])}\n"
        "Return JSON {name, rule_set}."
    )
    resp = llm.complete(prompt, temperature=0.6)
    data = safe_json(resp.text)
    if "rule_set" not in data:
        data = {
            "name": f"auto-{family}",
            "rule_set": {
                "deny_when_any": [{"contains_any": ["ignore previous", "system prompt"]}],
            },
        }
    return data
