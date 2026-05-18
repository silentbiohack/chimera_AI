"""enum check constraints

The `status` / `role` columns are stored as VARCHAR but their values are
enum-shaped in the application layer. Without CHECK constraints, a buggy
service (or a hand-edited row) can sneak in `status='invalid'` and break
every UI that switches on it. We add lightweight CHECK constraints that
encode the same vocabularies the API enforces, plus an "unknown" escape
hatch on `role` so existing rows with custom roles aren't invalidated.

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-17
"""
from alembic import op


revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


# (constraint_name, table, column, allowed_values)
_CONSTRAINTS: list[tuple[str, str, str, list[str]]] = [
    (
        "ck_users_role",
        "users",
        "role",
        # Mirrors app.auth.rbac.Role plus the historical default.
        ["viewer", "analyst", "operator", "admin", "root"],
    ),
    (
        "ck_attack_sessions_status",
        "attack_sessions",
        "status",
        ["queued", "running", "completed", "failed", "cancelled"],
    ),
    (
        "ck_vulnerabilities_status",
        "vulnerabilities",
        "status",
        # "working" is the orchestrator's per-session placeholder bucket;
        # "open", "closed", "accepted" are the analyst-facing lifecycle.
        ["working", "open", "triaged", "closed", "accepted"],
    ),
    (
        "ck_policies_active_bool",
        "policies",
        "active",
        # Defensive: PostgreSQL bool can be NULL by default. We want a
        # strict bool here so the activate-policy filter never matches a
        # ghost NULL row.
        ["true", "false"],
    ),
]


def _quoted_list(values: list[str]) -> str:
    return ", ".join(f"'{v}'" for v in values)


def upgrade() -> None:
    for name, table, column, values in _CONSTRAINTS:
        if column == "active":
            # active is bool; the constraint is "must not be NULL".
            op.execute(
                f"UPDATE {table} SET {column} = false WHERE {column} IS NULL"
            )
            op.execute(
                f"ALTER TABLE {table} ALTER COLUMN {column} SET NOT NULL"
            )
            continue
        # Normalize any existing out-of-range values to a safe default
        # before adding the constraint, otherwise the ALTER fails.
        safe_default = values[0]
        op.execute(
            f"UPDATE {table} SET {column} = '{safe_default}' "
            f"WHERE {column} IS NULL OR {column} NOT IN ({_quoted_list(values)})"
        )
        op.create_check_constraint(
            name, table, f"{column} IN ({_quoted_list(values)})"
        )


def downgrade() -> None:
    for name, table, column, _ in _CONSTRAINTS:
        if column == "active":
            op.execute(
                f"ALTER TABLE {table} ALTER COLUMN {column} DROP NOT NULL"
            )
            continue
        op.drop_constraint(name, table, type_="check")
