# Root Dockerfile for Railway / Render / Fly.io deployment of the
# CHIMERA backend (FastAPI + worker entry-points share one image).
#
# Railway auto-detects this file because it sits at the repo root. The
# frontend and worker run as separate Railway services pointing at the
# same image with different start commands.
#
# Required env vars in Railway:
#   DATABASE_URL    — provided automatically by the Postgres add-on
#   REDIS_URL       — provided automatically by the Redis add-on
#   JWT_SECRET      — generate 32+ random bytes; set in service vars
#   ENVIRONMENT     — "production"  (enforces strict validators)
#   PORT            — injected by Railway; uvicorn binds to it
#
# Optional:
#   GEMINI_API_KEY  — enables live Gemini routing; otherwise synthetic
#   CORS_ORIGINS    — comma-separated list of allowed frontend origins
#   BUS_MODE        — auto | redis | local  (defaults to auto)

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Build deps for psycopg2 / bcrypt + curl for the healthcheck probe.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential curl \
    && rm -rf /var/lib/apt/lists/*

# Layer requirements separately so dep-only changes don't bust the
# whole image cache.
COPY backend/requirements.txt /app/requirements.txt
RUN pip install -U pip && pip install -r requirements.txt

# Copy the backend source. alembic.ini sits at the backend root, so its
# `script_location = alembic` resolves to /app/alembic — same layout as
# the dev container.
COPY backend /app

# Drop privileges. UID 1000 matches the typical host user.
RUN groupadd --system --gid 1000 chimera \
    && useradd --system --uid 1000 --gid chimera --home-dir /app --shell /usr/sbin/nologin chimera \
    && chown -R chimera:chimera /app
USER chimera

# Railway sets PORT at runtime; default to 8000 for local docker runs.
ENV PORT=8000
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=4s --start-period=30s --retries=5 \
    CMD curl -fsS "http://localhost:${PORT}/healthz" || exit 1

# Apply pending migrations on boot, then start uvicorn bound to $PORT.
# `sh -c` is needed for env-var expansion in the CMD form.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
