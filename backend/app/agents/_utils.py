"""Shared helpers for the agent layer."""
from __future__ import annotations

import json
import re
from typing import Any


_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE | re.MULTILINE)


def safe_json(text: str) -> dict[str, Any]:
    """Robustly parse LLM output into a dict.

    Tolerates:
      * surrounding markdown code fences (```json … ```)
      * leading/trailing whitespace
      * a stray prose preamble before the first `{`

    Returns an empty dict on failure rather than raising — callers always
    have a sensible default to fall back on.
    """
    if not text:
        return {}
    cleaned = _FENCE_RE.sub("", text).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    # Last-ditch: extract the first balanced JSON object.
    start = cleaned.find("{")
    if start < 0:
        return {}
    depth = 0
    for i in range(start, len(cleaned)):
        c = cleaned[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(cleaned[start:i + 1])
                except json.JSONDecodeError:
                    return {}
    return {}
