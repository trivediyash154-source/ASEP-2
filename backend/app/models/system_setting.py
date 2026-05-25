"""Key-value system settings table — persists operator-configurable pipeline params."""
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import BaseModel


class SystemSetting(BaseModel):
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=True, default="")
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="general")
    updated_by: Mapped[str] = mapped_column(String(255), nullable=True)
