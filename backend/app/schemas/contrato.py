from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ContratoBase(BaseModel):
    name: str
    description: Optional[str] = None
    grupo_id: int
    is_active: bool = True

class ContratoCreate(ContratoBase):
    pass

class ContratoUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    grupo_id: Optional[int] = None
    is_active: Optional[bool] = None

class ContratoOut(ContratoBase):
    id: int
    created_at: datetime
    grupo_name: Optional[str] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_grupo(cls, contrato):
        obj = cls.model_validate(contrato)
        obj.grupo_name = contrato.grupo.name if contrato.grupo else None
        return obj
