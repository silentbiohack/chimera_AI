"""Tiny Redis-backed job queue (no Celery dep). Fault-tolerant retries.

`reserve` returns the *original* raw payload alongside the parsed dict so
`ack` can LREM the exact byte string that's sitting in the inflight list.
Re-serializing via json.dumps can produce a different byte sequence (key
ordering, float formatting, etc.) and silently fail to remove the entry.
"""
from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from typing import Any

import redis

from app.config import settings


_QUEUE_KEY = "chimera.jobs"
_INFLIGHT_KEY = "chimera.jobs.inflight"


@dataclass
class ReservedJob:
    raw: str
    job: dict[str, Any]


def _client() -> redis.Redis:
    return redis.from_url(settings.redis_url, decode_responses=True)


def enqueue(kind: str, payload: dict[str, Any], *, attempt: int = 0) -> str:
    job_id = str(uuid.uuid4())
    body = json.dumps({
        "id": job_id, "kind": kind, "payload": payload, "attempt": attempt,
    })
    _client().lpush(_QUEUE_KEY, body)
    return job_id


def reserve(timeout_s: int = 5) -> ReservedJob | None:
    raw = _client().brpoplpush(_QUEUE_KEY, _INFLIGHT_KEY, timeout=timeout_s)
    if not raw:
        return None
    try:
        return ReservedJob(raw=raw, job=json.loads(raw))
    except json.JSONDecodeError:
        # Malformed payload — drop it from inflight so it doesn't leak forever.
        _client().lrem(_INFLIGHT_KEY, 1, raw)
        return None


def ack(job_raw: str) -> None:
    _client().lrem(_INFLIGHT_KEY, 1, job_raw)


def retry(job: dict[str, Any], max_attempts: int = 3) -> None:
    if job["attempt"] + 1 >= max_attempts:
        return
    enqueue(job["kind"], job["payload"], attempt=job["attempt"] + 1)
