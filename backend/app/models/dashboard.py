from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class Dashboard(Base):
    __tablename__ = "dashboards"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), default="bi")
    embed_url = Column(Text, nullable=False)
    cover_image_url = Column(String(500), nullable=True)
    parquet_file = Column(String(500), nullable=True)
    dax_context = Column(Text, nullable=True)
    tags = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    is_public = Column(Boolean, default=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)   # grupo (legado)
    contrato_id = Column(Integer, ForeignKey("contratos.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    client = relationship("Grupo", foreign_keys=[client_id])
    contrato = relationship("Contrato", back_populates="dashboards")
    creator = relationship("User", foreign_keys=[created_by])
    permissions = relationship("Permission", back_populates="dashboard", cascade="all, delete-orphan")
    access_logs = relationship("AccessLog", back_populates="dashboard", cascade="all, delete-orphan")
