from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class AccessLog(Base):
    __tablename__ = "access_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"), nullable=True)
    action = Column(String(100), nullable=False)  # login, view_dashboard, ai_query, etc.
    detail = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="access_logs")
    dashboard = relationship("Dashboard", back_populates="access_logs")
