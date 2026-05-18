from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models._mixins import UUIDPK, Timestamped


class Tenant(UUIDPK, Timestamped, Base):
    __tablename__ = "tenants"

    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    plan: Mapped[str] = mapped_column(String(40), default="trial", nullable=False)
