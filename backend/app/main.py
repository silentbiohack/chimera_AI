from __future__ import annotations

import logging
import os
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

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


# ---------------------------------------------------------------------------
# Meta routes (kept at root so liveness probes don't need /api prefix)
# ---------------------------------------------------------------------------

@app.get("/healthz", tags=["meta"])
def healthz() -> dict:
    return {"status": "ok", "env": settings.environment, "llm_mode": settings.llm_mode}


# ---------------------------------------------------------------------------
# API routers — mounted under /api so they don't collide with frontend
# routes (/arena, /threats, /reports are SPA pages too).
# ---------------------------------------------------------------------------

app.include_router(auth.router,     prefix="/api")
app.include_router(agents.router,   prefix="/api")
app.include_router(arena.router,    prefix="/api")
app.include_router(threats.router,  prefix="/api")
app.include_router(policies.router, prefix="/api")
app.include_router(reports.router,  prefix="/api")
# WebSocket stays at /ws/* (no /api prefix) — the frontend builds its WS
# URL relative to window.location.host and doesn't want an extra hop.
app.include_router(ws.router)


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):  # pragma: no cover
    # HTTPException is handled by Starlette's own handler — we'd otherwise
    # mask the intended 4xx response with a generic 500.
    if isinstance(exc, HTTPException):
        raise exc
    log.exception("unhandled")
    return JSONResponse(status_code=500, content={"detail": "internal error"})


# ---------------------------------------------------------------------------
# Frontend SPA — optional, only mounted when a build is present at the path
# pointed to by FRONTEND_DIST (default /app/frontend_dist).
#
# Layout produced by `next build` with `output: 'export'`:
#     out/
#       index.html
#       arena/index.html
#       genome/index.html
#       ...
#       _next/static/...
#
# Routing strategy:
#   /_next/*       → static asset (StaticFiles)
#   /<route>/      → corresponding index.html
#   anything else  → out/index.html (SPA fallback handled by client router)
# ---------------------------------------------------------------------------

_FRONTEND_DIST = Path(os.getenv("FRONTEND_DIST", "/app/frontend_dist"))

if _FRONTEND_DIST.is_dir() and (_FRONTEND_DIST / "index.html").is_file():
    _next_assets = _FRONTEND_DIST / "_next"
    if _next_assets.is_dir():
        app.mount("/_next", StaticFiles(directory=_next_assets), name="next-assets")

    # Root: serve marketing landing page.
    @app.get("/", include_in_schema=False)
    def _spa_root() -> FileResponse:
        return FileResponse(_FRONTEND_DIST / "index.html")

    # Per-route exact handler — Next.js export emits one folder per page.
    @app.get("/{page_path:path}", include_in_schema=False)
    def _spa_route(page_path: str) -> FileResponse:
        # Block paths that look like API/meta to keep error messages clean.
        if page_path.startswith(("api/", "ws/", "docs", "openapi.json", "healthz")):
            raise HTTPException(status_code=404)

        # Try exact static file (favicon.ico, robots.txt, og images, etc.).
        exact = _FRONTEND_DIST / page_path
        if exact.is_file():
            return FileResponse(exact)

        # Try the Next.js export layout: `<route>/index.html`.
        page_html = _FRONTEND_DIST / page_path.rstrip("/") / "index.html"
        if page_html.is_file():
            return FileResponse(page_html)

        # SPA fallback — let the client router resolve unknown paths and
        # render the 404 component itself.
        return FileResponse(_FRONTEND_DIST / "index.html")
else:
    # Backend-only mode (no frontend baked in) — keep the marketing JSON
    # at / so the old behaviour is preserved when running the API alone.
    @app.get("/", tags=["meta"])
    def _api_only_root() -> dict:
        return {
            "name": "CHIMERA",
            "tagline": "the autonomous immune system for enterprise AI agents",
            "docs": "/docs",
        }
