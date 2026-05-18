"""Realtime arena telemetry over WebSocket."""
from __future__ import annotations

import asyncio
import json
import logging
import uuid

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

from app.auth.security import decode_token
from app.events import bus

log = logging.getLogger("chimera.ws")
router = APIRouter(tags=["ws"])


@router.websocket("/ws/arena")
async def arena_ws(ws: WebSocket, token: str = Query(...)) -> None:
    try:
        claims = decode_token(token)
        tenant_id = uuid.UUID(claims["tid"])
        # WS endpoints accept the dedicated short-lived ws-token. We still
        # accept the bearer for backwards compat during the rollout.
        if claims.get("scope") not in (None, "ws"):
            raise ValueError("invalid token scope")
    except Exception:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws.accept()
    queue: asyncio.Queue = asyncio.Queue(maxsize=2000)

    async def pump_in() -> None:
        # async-generator finally clause removes us from the bus subscriber
        # list when the task is cancelled — that's load-bearing for the
        # in-memory bus (every subscribed client holds a queue).
        async for event in bus.subscribe("arena"):
            if event.get("tenant_id") != str(tenant_id):
                continue
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                pass

    async def pump_out() -> None:
        while True:
            event = await queue.get()
            await ws.send_text(json.dumps(event, default=str))

    in_task = asyncio.create_task(pump_in())
    out_task = asyncio.create_task(pump_out())
    try:
        while True:
            # heartbeat / liveness ping from client
            await asyncio.wait_for(ws.receive_text(), timeout=60)
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    except Exception:
        log.exception("ws loop crashed for tenant=%s", tenant_id)
    finally:
        # Cancelling alone schedules cancellation but doesn't guarantee the
        # coroutine's finally has run before we return. We must await both
        # tasks (suppressing the CancelledError they'll raise) so the bus
        # subscription is actually torn down before the handler exits —
        # otherwise the subscriber queue lingers in _LocalBus._subs.
        for t in (in_task, out_task):
            t.cancel()
        await asyncio.gather(in_task, out_task, return_exceptions=True)
        try:
            await ws.close()
        except Exception:
            pass
