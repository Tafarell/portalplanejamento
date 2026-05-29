import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.database import Base

class PermissionScope(str, enum.Enum):
    DASHBOARD = "dashboard"   # dashboard específico
    CONTRATO = "contrato"     # todos os dashboards do contrato
    GRUPO = "grupo"           # todos os dashboards do grupo

class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    scope = Column(Enum(PermissionScope), default=PermissionScope.DASHBOARD, nullable=False)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"), nullable=True)
    contrato_id = Column(Integer, ForeignKey("contratos.id"), nullable=True)
    grupo_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    can_view = Column(Boolean, default=True)
    granted_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="permissions")
    dashboard = relationship("Dashboard", back_populates="permissions")
    contrato = relationship("Contrato")
    grupo = relationship("Grupo", foreign_keys=[grupo_id])
