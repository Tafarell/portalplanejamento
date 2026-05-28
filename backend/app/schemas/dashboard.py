from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.dashboard import DashboardCategory

class DashboardBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: DashboardCategory = DashboardCategory.BI
    embed_url: str
    tags: Optional[str] = None
    is_active: bool = True
    is_public: bool = False
    client_id: Optional[int] = None
    dax_context: Optional[str] = None

class DashboardCreate(DashboardBase):
    pass

class DashboardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[DashboardCategory] = None
    embed_url: Optional[str] = None
    tags: Optional[str] = None
    is_active: Optional[bool] = None
    is_public: Optional[bool] = None
    client_id: Optional[int] = None
    dax_context: Optional[str] = None

class DashboardOut(DashboardBase):
    id: int
    cover_image_url: Optional[str] = None
    parquet_file: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
