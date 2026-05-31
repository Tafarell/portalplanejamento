from sqlalchemy import Column, Integer, ForeignKey
from app.database import Base

class UserPBIConnection(Base):
    __tablename__ = "user_pbi_connections"
    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False)
    connection_id = Column(Integer, ForeignKey("pbi_connections.id"), nullable=False)
