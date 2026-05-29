from sqlalchemy import Column, Integer, String, Boolean, DateTime
from datetime import datetime
from app.database import Base


class PBIConnection(Base):
    __tablename__ = "pbi_connections"

    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String(100), default="Conexão Power BI")
    dataset_id    = Column(String(300), nullable=False)
    tenant_id     = Column(String(300), nullable=False)
    client_id     = Column(String(300), nullable=False)
    client_secret = Column(String(500), nullable=False)
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime, default=datetime.utcnow)
