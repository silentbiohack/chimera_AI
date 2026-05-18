"""In-process pub/sub for streaming arena telemetry to WS clients.

Backed by Redis Pub/Sub when reachable; otherwise an in-memory asyncio bus.
Both expose the same `publish` / `subscribe` interface so callers don't care.

Mode selection (controlled by `BUS_MODE`):
    redis  — force Redis; raise on boot if unreachable
    local  — force in-memory (fine for single-process / tests)
    auto   — try Redis once at boot, fall back to local on failure

The previous implementation always returned the Redis bus (because the
constructor was lazy and never failed), which meant WS streaming would
silently break if Redis went down. We now ping at boot.
"""
from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from typing import AsyncIterator

import redis  # sync client for the boot-time ping
import redis.asyncio as redis_async

from app.config import settings

log = logging.getLogger("chimera.events")

_CHANNEL = "chimera.events"


class _LocalBus:
    """Single-process in-memory bus. Suitable for tests and single-replica dev."""

    def __init__(self) -> None:
        self._subs: dict[str, list[asyncio.Queue]] = defaultdict(list)

    async def publish(self, topic: str, event: dict) -> None:
        for q in list(self._subs[topic]):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                # Slow consumer — drop the oldest and put the new one in.
                try:
                    q.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                try:
                    q.put_nowait(event)
                except asyncio.QueueFull:
                    pass

    async def subscribe(self, topic: str) -> AsyncIterator[dict]:
        q: asyncio.Queue = asyncio.Queue(maxsize=2000)
        self._subs[topic].append(q)
        try:
            while True:
                yield await q.get()
        finally:
            try:
                self._subs[topic].remove(q)
            except ValueError:
                pass


class _RedisBus:
    def __init__(self, url: str) -> None:
        self._url = url
        self._pub: redis_async.Redis | None = None

    async def _ensure(self) -> redis_async.Redis:
        if self._pub is None:
            self._pub = redis_async.from_url(self._url, decode_responses=True)
        return self._pub

    async def publish(self, topic: str, event: dict) -> None:
        r = await self._ensure()
        await r.publish(f"{_CHANNEL}.{topic}", json.dumps(event, default=str))

    async def subscribe(self, topic: str) -> AsyncIterator[dict]:
        r = redis_async.from_url(self._url, decode_responses=True)
        ps = r.pubsub()
        await ps.subscribe(f"{_CHANNEL}.{topic}")
        try:
            async for msg in ps.listen():
                if msg.get("type") != "message":
                    continue
                try:
                    yield json.loads(msg["data"])
                except json.JSONDecodeError:
                    continue
        finally:
            try:
                await ps.unsubscribe()
            finally:
                await ps.close()
                await r.close()


def _ping_redis(url: str, timeout: float = 1.5) -> bool:
    try:
        client = redis.from_url(url, socket_connect_timeout=timeout)
        return bool(client.ping())
    except Exception as e:  # noqa: BLE001
        log.warning("redis ping failed url=%s err=%s", url, e)
        return False


def _make_bus():
    mode = settings.bus_mode
    if mode == "local":
        log.info("bus mode=local (forced)")
        return _LocalBus()
    if mode == "redis":
        if not _ping_redis(settings.redis_url):
            raise RuntimeError(
                "BUS_MODE=redis but redis is unreachable at "
                f"{settings.redis_url}"
            )
        log.info("bus mode=redis (forced)")
        return _RedisBus(settings.redis_url)
    # auto: try once, fall back to local
    if settings.redis_url and _ping_redis(settings.redis_url):
        log.info("bus mode=auto → redis")
        return _RedisBus(settings.redis_url)
    log.warning("bus mode=auto → local (redis unreachable)")
    return _LocalBus()


bus = _make_bus()
