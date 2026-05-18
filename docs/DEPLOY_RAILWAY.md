# Deploy on Railway

The repo root contains a single `Dockerfile` aimed at the **backend**.
Railway's auto-detector will pick it up — `railpack` no longer trips on
the mixed monorepo.

The platform is a 3-piece deployment on Railway:

| Service        | Source              | Start command                                                              |
| -------------- | ------------------- | -------------------------------------------------------------------------- |
| `chimera-api`  | this repo, root `Dockerfile` | (default — runs `alembic upgrade head && uvicorn` on `$PORT`)   |
| `chimera-worker` | this repo, same image | override to `python -m app.workers.runner`                              |
| `postgres`     | Railway add-on      | —                                                                          |
| `redis`        | Railway add-on      | —                                                                          |
| `chimera-web`  | this repo, frontend Dockerfile | see "Frontend" below — optional, ship later                     |

## 1. Provision data layer

In your Railway project:

1. **+ New → Database → Add PostgreSQL** — copy the `DATABASE_URL` shown
   on the variables tab (Railway auto-mounts it on services that
   reference the DB, so usually no manual copy needed).
2. **+ New → Database → Add Redis** — same, `REDIS_URL` is auto-injected.

## 2. Deploy the API service

1. **+ New → Deploy from GitHub repo** → pick `silentbiohack/chimera_AI`.
2. Railway detects the root `Dockerfile` and builds. No further config
   required for the build itself.
3. Open the service's **Variables** tab and set:

   ```
   DATABASE_URL=<reference: Postgres.DATABASE_URL>
   REDIS_URL=<reference: Redis.REDIS_URL>
   JWT_SECRET=<32+ random bytes — see below>
   ENVIRONMENT=production
   CORS_ORIGINS=https://<your-frontend-host>
   ```

   Optional:
   ```
   GEMINI_API_KEY=<from aistudio.google.com>
   LLM_MODE=gemini       # default: synthetic
   BUS_MODE=redis        # default: auto
   ```

   Generate a strong secret locally:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

4. Hit **Generate domain** under Networking — Railway returns a public
   URL. Hit `/healthz` to confirm boot.

## 3. Deploy the worker

Workers consume Redis-queued jobs (arena sessions). Same image, different
start command.

1. **+ New → Empty service** in the same project.
2. Source → same GitHub repo + root Dockerfile.
3. Variables: same as `chimera-api` (the worker needs DB + Redis too).
4. **Settings → Deploy → Custom start command**:
   ```
   python -m app.workers.runner
   ```
5. Disable the healthcheck on this service — the worker has no HTTP
   port. (Settings → Healthcheck → blank path.)

## 4. Frontend (optional)

Next.js needs a different build target. Two paths:

**Vercel (recommended for Next.js)** — connect the same repo, set the
root to `frontend/`, set `NEXT_PUBLIC_API_BASE` and `NEXT_PUBLIC_WS_BASE`
to your Railway API domain (`https://chimera-api-…railway.app` and
`wss://chimera-api-…railway.app`).

**Railway** — add another service with a custom Dockerfile path:
```
Settings → Source → Dockerfile path: frontend/Dockerfile
```
The included `frontend/Dockerfile` runs `npm run dev` which is fine for
demo but you'll want `npm run build && npm start` for prod.

## 5. Run migrations manually (only if you ever need to)

The API service runs `alembic upgrade head` on every boot, so migrations
apply on the first deploy automatically. If you need to run them ad-hoc
(e.g. after restoring a backup):

```bash
railway run --service chimera-api -- alembic upgrade head
```

## Troubleshooting

* **`railpack process exited with an error`** — happens when no Dockerfile
  is found and railpack can't classify the project. Fixed by the root
  Dockerfile in this commit.
* **`could not translate host name "postgres"`** — you've still got the
  compose-local hostname in env. Set `DATABASE_URL` from the Postgres
  add-on; the app will prefer it over `POSTGRES_HOST/USER/...`.
* **`JWT_SECRET must be set to ≥32 bytes in production`** — set a real
  secret (see step 2). The startup-time check is intentional.
* **Healthcheck failing during cold start** — increase
  `start_period` if Postgres add-on takes long to accept connections
  (rare; Railway usually warms in < 10 s).
