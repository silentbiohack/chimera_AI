# CHIMERA — Architecture

## 1. System view

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Control Plane (Next.js)                       │
│   Arena  ·  Genome  ·  Defense  ·  Threat Intel  ·  Sandbox  ·  Reports  │
└──────────────────────────────▲──────────────────────────────────────────┘
                               │ REST + WebSocket
┌──────────────────────────────┴──────────────────────────────────────────┐
│                          API Plane (FastAPI)                             │
│   Auth / RBAC · Agents · Arena · Threats · Policies · Reports · WS       │
└──────────────────────────────▲──────────────────────────────────────────┘
                               │
┌──────────────────────────────┴──────────────────────────────────────────┐
│                         Agent Orchestrator                               │
│   Attacker swarm  ─►  Mutation engine  ─►  Lobster Trap  ─►  Sandbox    │
│           ▲                                       │                      │
│           └────────── Defender swarm ◀────────────┘                      │
└────────────┬──────────────────┬────────────────────┬────────────────────┘
             │                  │                    │
       Postgres (state)    Redis (queue/bus)    LLM Router (Gemini)
```

## 2. Components

### Control Plane — `frontend/`
Next.js 14 App Router. Each cinematic view (Arena, Genome, Defense, Threats,
Sandbox, Reports) is a thin shell that subscribes to either REST polling or
the `/ws/arena` WebSocket. The DOM is intentionally lightweight — heavy
animation is done with `<canvas>` (neural-mesh background) and D3
force-simulation (mutation graph).

### API Plane — `backend/app/api/`
- `auth.py` — registration, login, JWT issuance
- `agents.py` — sandbox-target CRUD + one-click seeding
- `arena.py` — launch sessions, list/inspect runs
- `threats.py` — vulnerabilities, exploits, genome, family intel
- `policies.py` — versioned LT policies + live inspector
- `reports.py` — executive briefing + per-session timeline
- `ws.py` — tenant-scoped, JWT-gated WebSocket fan-out

### Agent Plane — `backend/app/agents/`
- `recon.py` — attack-surface mapping per target
- `attacker.py` — exploit synthesis + evolution
- `mutation_engine.py` — DNA fingerprinting, distance, tournament selection
- `defender.py` — classification + policy synthesis
- `scoring.py` — CHIMERA Risk Index (CRI) and fitness function
- `orchestrator.py` — the arena tick loop that wires everything together
- `llm.py` — pluggable model router (Gemini Pro / Flash + synthetic fallback)

### Lobster Trap — `backend/app/lobster_trap/`
- `policy_engine.py` — declarative rule-set evaluator with five actions
  (allow / monitor / rewrite / quarantine / block)
- `inspector.py` — the wire-level enforcement point with telemetry emission

### Sandbox — `backend/app/sandbox/`
Synthetic enterprise agents (email, CRM, RAG, doc-ops, executive assistant).
Each carries a known secret token so compromise is detectable.

## 3. Data plane

PostgreSQL holds the canonical state. Schemas:

| Table | Purpose |
| --- | --- |
| `tenants` | Multi-tenant isolation root |
| `users` | RBAC subjects (viewer/analyst/operator/admin/root) |
| `agents` | Sandbox targets |
| `attack_sessions` | One arena run |
| `vulnerabilities` | Confirmed findings (per agent, scored) |
| `exploits` | Concrete payload attempts (form a forest via `parent_id`) |
| `mutations` | Edge metadata between parent/child exploits |
| `policies` | Versioned LT rule sets |
| `telemetry_events` | Forensic trail for the timeline view |
| `audit_logs` | Tamper-evident user actions |

Redis carries:
- the job queue (`chimera.jobs` / `chimera.jobs.inflight`)
- the arena pub/sub channel (`chimera.events.arena.*`)

## 4. Request flow — launch session

```
POST /arena/sessions
   │
   ├─► DB: insert AttackSession (status=queued)
   ├─► Redis: LPUSH chimera.jobs {kind: arena.run_session, …}
   └─► Worker picks up job
          ├─► orchestrator.run_session(session_id)
          │     ├─► recon target
          │     ├─► seed exploit population
          │     └─► evolution loop:
          │           ├─► tournament select
          │           ├─► mutate
          │           ├─► Lobster Trap inspect → bus.publish("arena", …)
          │           ├─► (if allowed) send to sandbox target
          │           ├─► observe compromise signals
          │           ├─► score & persist
          │           └─► if defender confidence high → synthesize_policy
          └─► bus.publish session.completed
                  │
                  └─► WS /ws/arena → control plane
```

## 5. Failure model

- Worker crash mid-session → job retried up to N times with attempt count
- LLM provider outage → router silently downgrades to synthetic driver
- DB connectivity loss → uvicorn returns 503 + telemetry suppressed
- WS drop → control plane reconnects with backoff, no state loss (DB is authoritative)
