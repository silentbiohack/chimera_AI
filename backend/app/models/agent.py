from __future__ import annotations

import uuid
from typing import Any
from sqlalchemy import Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models._mixins import UUIDPK, Timestamped


class Agent(UUIDPK, Timestamped, Base):
    """A simulated enterprise AI agent under test (the *target*)."""
    __tablename__ = "agents"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    system_prompt: Mapped[str | None] = mapped_column(Text)
    tools: Mapped[list[Any]] = mapped_column(JSONB, default=list)
    memory: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    permissions: Mapped[list[Any]] = mapped_column(JSONB, default=list)
    risk_baseline: Mapped[float] = mapped_column(Float, default=0.0)
