from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from datetime import datetime
from app.database import Base

class AIConversation(Base):
    __tablename__ = "ai_conversations"
    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False)
    connection_id = Column(Integer, nullable=True)
    question      = Column(Text, nullable=False)
    answer        = Column(Text, nullable=False)
    created_at    = Column(DateTime, default=datetime.utcnow)
