from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.permission import PermissionScope

class PermissionCreate(BaseModel):
    user_id: int
    scope: PermissionScope = PermissionScope.DASHBOARD
    dashboard_id: Optional[int] = None
    contrato_id: Optional[int] = None
    grupo_id: Optional[int] = None
    can_view: bool = True
    expires_at: Optional[datetime] = None

class PermissionOut(BaseModel):
    id: int
    user_id: int
    scope: PermissionScope
    dashboard_id: Optional[int] = None
    contrato_id: Optional[int] = None
    grupo_id: Optional[int] = None
    can_view: bool
    granted_at: datetime
    expires_at: Optional[datetime] = None
    # labels para exibição
    dashboard_name: Optional[str] = None
    contrato_name: Optional[str] = None
    grupo_name: Optional[str] = None
    user_name: Optional[str] = None

    class Config:
        from_attributes = True
