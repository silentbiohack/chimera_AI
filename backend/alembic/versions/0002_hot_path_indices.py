"""hot-path indices

Adds indices that cover the read-heavy endpoints (threat intel, arena listing,
audit log review). Without these the ORDER BY / WHERE combinations in
api/threats.py and api/arena.py fall back to sequential scans once tables
reach low-million row counts.

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-16
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


_INDICES: list[tuple[str, str, list[str]]] = [
    # name, table, columns
    ("ix_vulns_tenant_status_severity", "vulnerabilities",
     ["tenant_id", "status", "severity DESC"]),
    ("ix_exploits_tenant_created",      "exploits",
     ["tenant_id", "created_at DESC"]),
    ("ix_sessions_tenant_created",      "attack_sessions",
     ["tenant_id", "created_at DESC"]),
    ("ix_audit_tenant_ts",              "audit_logs",
     ["tenant_id", "ts DESC"]),
    ("ix_policies_tenant_active_ver",   "policies",
     ["tenant_id", "active", "version DESC"]),
    ("ix_telemetry_tenant_ts",          "telemetry_events",
     ["tenant_id", "ts DESC"]),
]


def upgrade() -> None:
    for name, table, cols in _INDICES:
        op.execute(
            f'CREATE INDEX IF NOT EXISTS "{name}" ON "{table}" '
            f'({", ".join(cols)})'
        )


def downgrade() -> None:
    for name, _table, _cols in _INDICES:
        op.execute(f'DROP INDEX IF EXISTS "{name}"')
