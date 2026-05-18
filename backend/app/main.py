from __future__ import annotations

import logging
import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import agents, arena, auth, policies, reports, threats, ws
from app.config import settings

log = logging.getLogger("chimera.api")
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)


app = FastAPI(
    title="CHIMERA",
    version="0.1.0",
    description="Autonomous adversarial intelligence platform.",
    docs_url="/docs",
    redoc_url=None,
)

_origins = settings.cors_origin_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    # allow_credentials=True is incompatible with allow_origins=["*"]; we only
    # enable it when no wildcard is present (which the prod gate already enforces).
    allow_credentials="*" not in _origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def access_log(request: Request, call_next):
    t0 = time.perf_counter()
    response = await call_next(request)
    dt = (time.perf_counter() - t0) * 1000
    log.info("%s %s -> %d (%.1f ms)", request.method, request.url.path, response.status_code, dt)
    response.headers["x-chimera-version"] = "0.1.0"
    return response


@app.get("/healthz", tags=["meta"])
def healthz() -> dict:
    return {"status": "ok", "env": settings.environment, "llm_mode": settings.llm_mode}


@app.get("/", tags=["meta"])
def root() -> dict:
    return {
        "name": "CHIMERA",
        "tagline": "the autonomous immune system for enterprise AI agents",
        "docs": "/docs",
    }


# Routers
app.include_router(auth.router)
app.include_router(agents.router)
app.include_router(arena.router)
app.include_router(threats.router)
app.include_router(policies.router)
app.include_router(reports.router)
app.include_router(ws.router)


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):  # pragma: no cover
    # HTTPException is handled by Starlette's own handler — we'd otherwise
    # mask the intended 4xx response with a generic 500.
    if isinstance(exc, HTTPException):
        raise exc
    log.exception("unhandled")
    return JSONResponse(status_code=500, content={"detail": "internal error"})
