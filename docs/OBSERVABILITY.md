# CHIMERA — Observability

## Three signal classes

1. **Operational metrics** (Prometheus-shape):
   - `chimera_api_request_duration_seconds{route,method,status}`
   - `chimera_worker_jobs_total{kind,outcome}`
   - `chimera_arena_active_sessions`
   - `chimera_llm_calls_total{model,mode}`
   - `chimera_policy_promotions_total{auto}`

2. **Domain telemetry** (Postgres `telemetry_events`):
   - `attacker.recon.complete`, `attacker.exploit.seeded`, `attacker.exploit.mutated`
   - `trap.inspection`, `trap.verdict`
   - `sandbox.target.reply`, `sandbox.compromise.signal`
   - `defender.classification`, `defender.policy.promoted`
   - `orchestrator.session.{started,completed}`, `orchestrator.tick`

3. **Audit log** (Postgres `audit_logs`):
   - immutable user-initiated actions (`agent.create`, `arena.start`, …)

## Dashboards

- **SOC**: top vulns by CRI, breach rate (7d), open criticals by tenant
- **Ops**: queue depth, worker latency, LLM error rate, p95 API latency
- **Product**: arena sessions/day, policies promoted, time-to-detect

## Alerts

| Alert | Threshold | Page |
| --- | --- | --- |
| API 5xx rate > 1% in 5 min | warning | #chimera-ops |
| Queue depth > 1000 for 2 min | page | on-call |
| LLM error rate > 5% in 5 min | warning | #chimera-ops |
| Auto-policy promotion failure rate > 10% | page | on-call |
| Critical vuln opened (severity ≥ 0.9) | informational | customer SOC |

## Tracing

OpenTelemetry traces (planned) on:
- arena session lifecycle (one span per tick)
- LLM call spans with model + token attributes
- trap-inspection spans with action + matched rules attributes
