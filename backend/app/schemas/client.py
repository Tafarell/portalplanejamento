from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ClientBase(BaseModel):
    name: str
    cnpj: Optional[str] = None
    contract_number: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True

class ClientCreate(ClientBase):
    pass

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    cnpj: Optional[str] = None
    contract_number: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class ClientOut(ClientBase):
    id: int
    logo_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
