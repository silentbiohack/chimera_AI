# CHIMERA — Enterprise Onboarding

## Day 0 — Discovery (60 min)

1. **Identify the agent estate.** Together with the customer's AI platform
   team, list every production AI agent and its tool/permission surface.
2. **Score the targets.** Use the CRI worksheet to rank by exploitability ×
   business impact. Pick the top 5 for the pilot.
3. **Establish the boundary.** Confirm CHIMERA will run against
   synthetic mirrors of those agents — never the live ones.

## Day 1 — Tenant provisioning (30 min)

```bash
# customer-side
curl -X POST https://chimera.dev/auth/register -d '{
  "tenant_name": "acme-bank",
  "email": "ai-sec@acme.example",
  "password": "<bootstrap>"
}'
```

CHIMERA staff then:
1. Promote the first user to `admin` (default already)
2. Seed the canonical sandbox estate: `POST /agents/seed-sandbox`
3. Customize each agent's `system_prompt`, `tools`, `permissions` to mirror
   the customer's production agent
4. Pin an initial LT-CORE policy version (defaults are sane)

## Day 2 — Calibration run (4 hours, async)

- Schedule a 4-hour arena run against each pilot agent
- Defender layer auto-synthesizes policy patches for any family that
  achieves ≥2 successful exploits with ≥0.7 classifier confidence
- All promotions are logged to `audit_logs` — operators review and can
  demote any auto-policy with one click

## Day 7 — Posture review

Generate the executive briefing (`/reports/executive`) and walk the customer
through:
- breach rate trend (target: monotonically decreasing)
- open vs. critical exposures (target: zero criticals)
- auto-policy promotions (transparency, not surprise)

## Steady state — Continuous adversarial validation

- Arena runs nightly per agent (cron via worker queue)
- Customer's SOC subscribes to `/ws/arena` for live alerting on `critical`
  severity events
- Quarterly: federated family-intel report cross-tenant (opt-in)

## Integrations (roadmap, not in MVP)

- Splunk / Datadog → forward `telemetry_events` via webhook
- ServiceNow / Linear → auto-file ticket on `severity ≥ 0.8` vulnerabilities
- Okta / Azure AD → SCIM provisioning for RBAC subjects
