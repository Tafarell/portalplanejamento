from sqlalchemy import Column, Integer, String, Boolean
from app.database import Base

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)       # ex: "Dashboards BI"
    slug = Column(String(50), nullable=False, unique=True)  # ex: "bi"
    icon = Column(String(50), nullable=True)          # nome do ícone lucide
    order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
