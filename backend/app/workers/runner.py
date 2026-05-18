"""Worker process. Pulls jobs from Redis and executes them.

Run with:  python -m app.workers.runner
"""
from __future__ import annotations

import asyncio
import logging
import uuid

from app.workers import queue as q

log = logging.getLogger("chimera.worker")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


async def _handle(job: dict) -> None:
    kind = job["kind"]
    payload = job["payload"]
    log.info("worker.start kind=%s job=%s", kind, job["id"])

    if kind == "arena.run_session":
        from app.agents.orchestrator import run_session
        await run_session(uuid.UUID(payload["session_id"]))
    else:
        log.warning("worker.unknown_kind kind=%s", kind)


async def main() -> None:
    log.info("chimera.worker.boot")
    while True:
        reserved = q.reserve(timeout_s=5)
        if not reserved:
            continue
        try:
            await _handle(reserved.job)
            q.ack(reserved.raw)
            log.info("worker.done kind=%s job=%s", reserved.job["kind"], reserved.job["id"])
        except Exception:
            log.exception("worker.failed kind=%s job=%s",
                          reserved.job["kind"], reserved.job["id"])
            q.ack(reserved.raw)
            q.retry(reserved.job)


if __name__ == "__main__":
    asyncio.run(main())
