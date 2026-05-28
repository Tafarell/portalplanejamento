import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class DashboardCategory(str, enum.Enum):
    BI = "bi"
    APP = "app"
    REPORT = "report"
    OTHER = "other"

class Dashboard(Base):
    __tablename__ = "dashboards"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(Enum(DashboardCategory), default=DashboardCategory.BI)
    embed_url = Column(Text, nullable=False)
    cover_image_url = Column(String(500), nullable=True)
    parquet_file = Column(String(500), nullable=True)  # caminho do arquivo Parquet
    dax_context = Column(Text, nullable=True)          # regras DAX / descrição das medidas
    tags = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    is_public = Column(Boolean, default=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    client = relationship("Client")
    creator = relationship("User", foreign_keys=[created_by])
    permissions = relationship("Permission", back_populates="dashboard", cascade="all, delete-orphan")
    access_logs = relationship("AccessLog", back_populates="dashboard", cascade="all, delete-orphan")
