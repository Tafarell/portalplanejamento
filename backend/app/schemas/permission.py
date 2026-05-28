from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class PermissionCreate(BaseModel):
    user_id: int
    dashboard_id: int
    client_id: Optional[int] = None
    can_view: bool = True
    expires_at: Optional[datetime] = None

class PermissionOut(BaseModel):
    id: int
    user_id: int
    dashboard_id: int
    client_id: Optional[int] = None
    can_view: bool
    granted_at: datetime
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True
