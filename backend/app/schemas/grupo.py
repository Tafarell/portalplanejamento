from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class GrupoBase(BaseModel):
    name: str
    cnpj: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True

class GrupoCreate(GrupoBase):
    pass

class GrupoUpdate(BaseModel):
    name: Optional[str] = None
    cnpj: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class GrupoOut(GrupoBase):
    id: int
    logo_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
