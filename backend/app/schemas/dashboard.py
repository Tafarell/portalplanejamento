from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime

class DashboardBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: str = "bi"
    embed_url: str
    tags: Optional[str] = None
    is_active: bool = True
    is_public: bool = False
    client_id: Optional[int] = None
    contrato_id: Optional[int] = None
    dax_context: Optional[str] = None

    @field_validator("category")
    @classmethod
    def normalize_category(cls, value: str) -> str:
        return value.strip().lower()

class DashboardCreate(DashboardBase):
    pass

class DashboardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    embed_url: Optional[str] = None
    tags: Optional[str] = None
    is_active: Optional[bool] = None
    is_public: Optional[bool] = None
    client_id: Optional[int] = None
    contrato_id: Optional[int] = None
    dax_context: Optional[str] = None

    @field_validator("category")
    @classmethod
    def normalize_category(cls, value: Optional[str]) -> Optional[str]:
        return value.strip().lower() if value else value

class DashboardOut(DashboardBase):
    id: int
    cover_image_url: Optional[str] = None
    parquet_file: Optional[str] = None
    contrato_name: Optional[str] = None
    grupo_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
