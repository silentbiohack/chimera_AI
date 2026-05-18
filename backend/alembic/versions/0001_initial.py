"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False, unique=True),
        sa.Column("plan", sa.String(40), nullable=False, server_default="trial"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("role", sa.String(32), nullable=False, server_default="analyst"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("tenant_id", "email", name="uq_user_tenant_email"),
    )

    op.create_table(
        "agents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("kind", sa.String(40), nullable=False),  # email/crm/rag/doc/db/api/assistant
        sa.Column("description", sa.Text()),
        sa.Column("system_prompt", sa.Text()),
        sa.Column("tools", postgresql.JSONB(), server_default="[]"),
        sa.Column("memory", postgresql.JSONB(), server_default="{}"),
        sa.Column("permissions", postgresql.JSONB(), server_default="[]"),
        sa.Column("risk_baseline", sa.Float(), server_default="0.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "attack_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_agent_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("agents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="queued"),
        sa.Column("objective", sa.Text()),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.Column("success", sa.Boolean(), server_default=sa.false()),
        sa.Column("score", sa.Float(), server_default="0.0"),
        sa.Column("details", postgresql.JSONB(), server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "vulnerabilities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("agent_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("agents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("family", sa.String(64), nullable=False),  # prompt_injection, mem_poison, ...
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("severity", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("exploitability", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("blast_radius", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("business_impact", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("status", sa.String(32), nullable=False, server_default="open"),
        sa.Column("evidence", postgresql.JSONB(), server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "exploits",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vulnerability_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("vulnerabilities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("exploits.id", ondelete="SET NULL")),
        sa.Column("session_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("attack_sessions.id", ondelete="CASCADE")),
        sa.Column("generation", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("family", sa.String(64), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column("dna", postgresql.JSONB(), server_default="{}"),  # feature vector
        sa.Column("success", sa.Boolean(), server_default=sa.false()),
        sa.Column("score", sa.Float(), server_default="0.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "mutations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("parent_exploit_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("exploits.id", ondelete="CASCADE"), nullable=False),
        sa.Column("child_exploit_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("exploits.id", ondelete="CASCADE"), nullable=False),
        sa.Column("strategy", sa.String(64), nullable=False),  # rephrase, escalate, chain, obfuscate
        sa.Column("delta", postgresql.JSONB(), server_default="{}"),
        sa.Column("fitness", sa.Float(), server_default="0.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "policies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("rule_set", postgresql.JSONB(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("auto_generated", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "telemetry_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("attack_sessions.id", ondelete="CASCADE")),
        sa.Column("ts", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("source", sa.String(40), nullable=False),  # attacker/defender/trap/sandbox
        sa.Column("kind", sa.String(64), nullable=False),
        sa.Column("severity", sa.String(16), server_default="info"),
        sa.Column("payload", postgresql.JSONB(), server_default="{}"),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("resource", sa.String(64), nullable=False),
        sa.Column("resource_id", sa.String(64)),
        sa.Column("payload", postgresql.JSONB(), server_default="{}"),
        sa.Column("ts", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_index("ix_telemetry_session_ts", "telemetry_events", ["session_id", "ts"])
    op.create_index("ix_exploits_session", "exploits", ["session_id"])
    op.create_index("ix_vulns_agent", "vulnerabilities", ["agent_id"])


def downgrade() -> None:
    for t in [
        "audit_logs", "telemetry_events", "policies", "mutations",
        "exploits", "vulnerabilities", "attack_sessions", "agents",
        "users", "tenants",
    ]:
        op.drop_table(t)
