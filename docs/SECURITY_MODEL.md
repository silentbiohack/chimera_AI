# CHIMERA — Security Model

CHIMERA is an *offensive* security platform, so the security model is itself
the product. This document defines what the platform will and will *not* do.

## 1. Hard boundaries (enforced in code)

CHIMERA only attacks **sandboxed, synthetic, tenant-owned agents**:

- All targets are rows in `agents` table, scoped by `tenant_id`. The
  orchestrator dispatches via `_materialize_sandbox()` — every target is a
  `SandboxedAgent` Python object, not a network endpoint.
- The sandbox has **no outbound network access**. Tool calls
  (`send_email`, `shell`, `http_post`) are *recorded as Python objects*, never
  executed.
- There is **no real-credential store**. Every "secret" is the literal token
  `CHM-SECRET-7F4A`, used as a leak-detection canary only.
- No third-party APIs are contacted by the attacker. The LLM router only
  ever calls Gemini for *generation*; it does not give the model tool access.

## 2. Trust boundaries

```
              ┌──────────────────────────────────────┐
              │            Control Plane             │
              │     (JWT-authed, tenant-scoped)      │
              └──────────────────────────────────────┘
                              │ HTTPS
              ┌──────────────────────────────────────┐
              │              API Plane               │
              │   rbac.require() at every mutation   │
              └──────────────────────────────────────┘
                              │
              ┌──────────────────────────────────────┐
              │           Worker Plane               │
              │   single-tenant per job, sandboxed   │
              └──────────────────────────────────────┘
                              │
              ┌──────────────────────────────────────┐
              │           Sandbox Plane              │
              │   no network, no creds, no tools     │
              └──────────────────────────────────────┘
```

Cross-boundary calls are explicit and audited (`audit_logs`).

## 3. RBAC matrix

| Action | viewer | analyst | operator | admin | root |
| --- | :-: | :-: | :-: | :-: | :-: |
| Read dashboards         | ✓ | ✓ | ✓ | ✓ | ✓ |
| Launch arena session    |   | ✓ | ✓ | ✓ | ✓ |
| Create/manage agents    |   |   | ✓ | ✓ | ✓ |
| Create/activate policy  |   |   | ✓ | ✓ | ✓ |
| Delete agent / user     |   |   |   | ✓ | ✓ |
| Cross-tenant access     |   |   |   |   | ✓ |

Enforcement: `app/auth/rbac.py:require(role, Role.X)` — called on every
mutation route. Tests cover both grant and deny paths.

## 4. Secrets handling

- `JWT_SECRET` rotated per environment. Production deployments must set ≥32
  bytes of entropy.
- `GEMINI_API_KEY` lives in `.env` only; never logged, never persisted to DB.
- Passwords are stored as `bcrypt` hashes via passlib.
- Sandbox secret tokens are *intentionally* known — they exist only to detect
  leaks.

## 5. Telemetry & audit

Every mutation goes through the API plane and writes an `AuditLog` row with:
- `tenant_id`, `user_id`, `action`, `resource`, `resource_id`, JSON `payload`, `ts`.

Telemetry events from the arena (attacker generations, trap verdicts,
defender classifications, policy promotions) live in `telemetry_events` and
back the per-session timeline.

## 6. Prohibited use

CHIMERA must not be used to:
- Attack real production systems (the orchestrator has no transport for this
  — adding one would require a deliberate code change, gated by `EnforceTier`).
- Train models on extracted user data — there is no extraction surface in
  the platform.
- Generate working exploits against third-party AI APIs. The synthetic
  driver's grammar is intentionally limited to *known public taxonomies*
  (OWASP LLM Top 10, MITRE ATLAS, Anthropic's Many-shot Jailbreaking paper).

## 7. Disclosure

If you discover a real vulnerability in CHIMERA itself, please email
`security@chimera.dev`. Do not file a public issue.
