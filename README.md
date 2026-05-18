# CHIMERA

> **The autonomous immune system for enterprise AI agents.**
> An AI-vs-AI adversarial intelligence platform that continuously discovers,
> mutates, evolves, and exploits vulnerabilities in enterprise AI systems —
> before real attackers do.

CHIMERA is a production-grade autonomous red team. It runs swarms of attacker
agents that perform reconnaissance, generate exploit chains, and evolve them
through mutation against a sandboxed enterprise environment. A parallel
defender layer — anchored on the **Veea Lobster Trap** policy engine —
detects, classifies, and quarantines those attacks, then auto-generates
policy patches.

```
                       ┌──────────────────────────────────────────┐
                       │           CHIMERA Control Plane          │
                       │  Arena · Genome · Defense · Threat Intel │
                       └──────────────────────────────────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        │                                │                                │
        ▼                                ▼                                ▼
 ┌────────────┐                  ┌─────────────┐                 ┌──────────────┐
 │  Attacker  │  ───exploit───▶  │   Lobster   │  ───telemetry──▶│   Defender   │
 │  Swarm     │ ◀──mutation──── │    Trap     │ ◀──policy────── │   Swarm      │
 └────────────┘                  └─────────────┘                 └──────────────┘
        │                                │                                │
        └─────────────┐         ┌────────┴────────┐         ┌─────────────┘
                      ▼         ▼                 ▼         ▼
                ┌──────────────────────────────────────────────┐
                │     Sandboxed Enterprise Agent Estate        │
                │   email · CRM · RAG · docs · API · DB · ...  │
                └──────────────────────────────────────────────┘
```

## What's in the box

| Module | What it does |
| --- | --- |
| **Attack Arena** | Live AI-vs-AI battles, exploit replay, attack-graph animation |
| **Attack Genome** | Exploit DNA, mutation lineage, family clustering, emergence detection |
| **Defense Core** | Policy engine, classification, scoring, quarantine, mitigation orchestration |
| **Threat Intelligence** | Family analysis, adaptive risk modeling, anomaly detection |
| **Enterprise Sandbox** | Simulated email/CRM/RAG/doc/DB agents with tool-call surfaces |
| **Lobster Trap Layer** | Prompt inspection, policy enforcement, auto-generated mitigations |

## Quick start

```bash
# 1. clone & configure
cp .env.example .env

# 2. bring up the stack
docker compose up --build

# 3. open the console
open http://localhost:3000
```

API: http://localhost:8000 · OpenAPI: http://localhost:8000/docs

## Tech stack

- **Frontend** — Next.js 14, React 18, TailwindCSS, Framer Motion, D3, Three.js
- **Backend** — Python 3.11, FastAPI, SQLAlchemy 2.0, Alembic, asyncio
- **AI** — Gemini Pro / Flash (pluggable model router), vector memory, LangGraph-style orchestration
- **Data** — PostgreSQL (primary), Redis (queue + pub/sub), pgvector (exploit embeddings)
- **Infra** — Docker, docker-compose, GitHub Actions CI, Kubernetes-ready Helm scaffold

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — system design, data flow, agent topology
- [Security Model](docs/SECURITY_MODEL.md) — threat model, sandbox boundaries, authorization
- [Pitch](docs/PITCH.md) — investor-grade one-pager
- [Demo Script](docs/DEMO_SCRIPT.md) — cinematic walk-through
- [Onboarding](docs/ONBOARDING.md) — enterprise tenant setup
- [Scaling](docs/SCALING.md) — horizontal scale-out plan

## Safety

CHIMERA only runs against **sandboxed, simulated, authorized** targets.
No real malware, no real credential theft, no third-party attacks.
See [SECURITY_MODEL.md](docs/SECURITY_MODEL.md) for the full boundary.

## License

Proprietary — all rights reserved.
