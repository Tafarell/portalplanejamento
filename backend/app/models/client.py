from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from app.database import Base

class Grupo(Base):
    __tablename__ = "clients"  # mantém tabela existente

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    cnpj = Column(String(20), nullable=True)
    contract_number = Column(String(100), nullable=True)
    logo_url = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="client")
    contratos = relationship("Contrato", back_populates="grupo", cascade="all, delete-orphan")

# Alias para compatibilidade com código existente
Client = Grupo
