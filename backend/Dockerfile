FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# build-essential is needed for some wheels (psycopg2, bcrypt) at install
# time but not at runtime. Keep curl for the HEALTHCHECK probe.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -U pip && pip install -r requirements.txt

COPY . .

# Drop privileges. UID 1000 matches the typical host user so bind mounts
# in dev (./backend:/app) stay writable. /app needs to be owned by us so
# alembic and any runtime-generated files don't hit EACCES.
RUN groupadd --system --gid 1000 chimera \
    && useradd --system --uid 1000 --gid chimera --home-dir /app --shell /usr/sbin/nologin chimera \
    && chown -R chimera:chimera /app
USER chimera

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
    CMD curl -fsS http://localhost:8000/healthz || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
