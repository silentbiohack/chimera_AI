# =============================================================================
# CHIMERA single-container build — FastAPI backend + Next.js static export.
#
# Stage 1 builds the Next.js frontend (`output: "export"` in next.config.js)
# into a tree of plain HTML/CSS/JS under /app/out.
#
# Stage 2 is the Python runtime that copies the export, installs backend
# dependencies, runs migrations on boot, and serves both /api/* + /ws/* +
# the static frontend on a single $PORT.
#
# Result: one Railway service, one URL, no CORS, no separate Vercel deploy,
# no worker container required (arena.py uses BackgroundTasks by default).
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1 — build the static frontend
# -----------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Install deps separately so a code-only change doesn't bust the npm cache.
COPY frontend/package.json frontend/package-lock.json* ./
# Use `npm install` (not `ci`) so we don't require a committed lockfile.
RUN npm install --no-audit --no-fund

# Copy the rest of the frontend and emit the static export under /app/out.
COPY frontend/ ./
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2 — Python runtime
# -----------------------------------------------------------------------------
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FRONTEND_DIST=/app/frontend_dist

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential curl \
    && rm -rf /var/lib/apt/lists/*

# Backend dependencies.
COPY backend/requirements.txt /app/requirements.txt
RUN pip install -U pip && pip install -r requirements.txt

# Backend source.
COPY backend /app

# Static frontend produced by stage 1.
COPY --from=frontend-builder /app/out /app/frontend_dist

# Drop privileges (UID 1000 matches typical host user for dev bind-mounts).
RUN groupadd --system --gid 1000 chimera \
    && useradd --system --uid 1000 --gid chimera --home-dir /app --shell /usr/sbin/nologin chimera \
    && chown -R chimera:chimera /app
USER chimera

ENV PORT=8000
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=4s --start-period=30s --retries=5 \
    CMD curl -fsS "http://localhost:${PORT}/healthz" || exit 1

# Apply pending migrations on boot, then serve the combined app on $PORT.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
