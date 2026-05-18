# CHIMERA — Helm scaffold

This is a thin scaffold intended for production hardening. The `docker-compose.yml`
at the repo root is the canonical local-dev environment; this chart is the
template a platform team would extend for Kubernetes.

Next steps when promoting to k8s:
- Render Deployments for `api`, `worker`, `frontend` from `values.yaml`
- Wire HPAs on `api` (CPU) and `worker` (queue depth via custom metric)
- Use ExternalSecrets for `JWT_SECRET` and `GEMINI_API_KEY`
- Use a managed Postgres + Redis (e.g., RDS + ElastiCache)
- Run `alembic upgrade head` as a pre-install/upgrade Job
