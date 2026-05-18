# CHIMERA — Scaling Strategy

## Horizontal scale-out plan

CHIMERA's hot path is **arena execution**: one session spawns dozens of LLM
calls and database writes per minute. The components scale independently.

### API plane
- Stateless FastAPI behind a load balancer
- Sticky sessions only required for WS (`/ws/arena`); use SWIM or
  consistent-hash routing if scaling to >10 replicas
- p95 latency budget: 80ms for REST, <250ms for `arena/sessions` POST
  (synchronous DB writes only; orchestrator runs out-of-band)

### Worker plane
- Pure Python worker (`app.workers.runner`) consuming Redis lists
- Each worker handles one session at a time; scale by replica count
- Backpressure: queue depth alerts at `LLEN chimera.jobs > 200`
- Concurrency knob: `ARENA_MAX_PARALLEL_ATTACKS` per session

### Data plane

| Service | Pattern | Scale unit |
| --- | --- | --- |
| PostgreSQL | Primary + read replicas | vertical first, then partition by `tenant_id` |
| Redis | Cluster mode | shard pub/sub channels per tenant |
| Object storage | S3-compatible | for replay archives (planned) |

PostgreSQL partitioning order (when needed, in this sequence):
1. `telemetry_events` — biggest by 10x; partition by `(tenant_id, ts)` weekly
2. `exploits` — partition by `tenant_id`
3. `audit_logs` — partition by `ts` monthly

### LLM layer
- Gemini Flash for high-volume, low-stakes calls (mutation, classification)
- Gemini Pro for low-volume, high-stakes calls (policy synthesis)
- Per-tenant budgets enforced at the router

## Multi-region

- Postgres → primary in one region, async read replica per geo
- Redis → per-region cluster, no cross-region replication
- Cross-region: federated tenant directory only; arena traffic never leaves
  its primary region

## SLOs (production targets)

| Surface | SLO |
| --- | --- |
| API availability | 99.9% monthly |
| Arena session completion | 99.5% within 2× declared budget |
| WS event delivery | p95 < 300 ms in-region |
| Policy promotion time | < 30 s from confidence threshold to active |

## Cost shape (back-of-envelope)

Per agent under protection, per month, at steady state:
- 30 nightly arena runs × ~500 LLM calls × ~$0.001 (Flash blend) = **$15/mo LLM**
- Postgres + Redis amortized: **$1/mo**
- Headroom + margin: **$25/mo cost on $333/mo price** (90% gross margin)

## Capacity tripwires

- Queue depth > 1000 → page on-call, auto-scale workers
- Redis pub/sub backlog > 5s → degrade to local bus, alert
- LLM error rate > 5% in 5 min → router flips to synthetic, banner in UI
- Postgres replication lag > 30s → reads pin to primary

## Production checklist

- [ ] SOC 2 controls: audit logs immutable (use append-only stream → S3)
- [ ] Secrets in KMS/Secrets Manager, not env files
- [ ] WAF on `/auth/*` (login throttle, brute-force lockout)
- [ ] WS auth: short-lived (5 min) JWTs, refresh on reconnect
- [ ] Per-tenant rate limits (Redis token bucket on `/arena/sessions`)
