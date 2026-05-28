from datetime import datetime
from sqlalchemy import Column, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base

class Permission(Base):
    __tablename__ = "permissions"
    __table_args__ = (
        UniqueConstraint("user_id", "dashboard_id", name="uq_user_dashboard"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    can_view = Column(Boolean, default=True)
    granted_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="permissions")
    dashboard = relationship("Dashboard", back_populates="permissions")
    client = relationship("Client", back_populates="permissions")
