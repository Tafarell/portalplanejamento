from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.access_log import AccessLog
from app.utils.security import require_admin
from pydantic import BaseModel
from datetime import datetime

class AccessLogOut(BaseModel):
    id: int
    user_id: int
    dashboard_id: Optional[int] = None
    action: str
    detail: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

router = APIRouter(prefix="/api/logs", tags=["Logs"])

@router.get("/", response_model=List[AccessLogOut])
def list_logs(user_id: Optional[int] = None, dashboard_id: Optional[int] = None,
              limit: int = 100, db: Session = Depends(get_db), admin=Depends(require_admin)):
    q = db.query(AccessLog)
    if user_id:
        q = q.filter(AccessLog.user_id == user_id)
    if dashboard_id:
        q = q.filter(AccessLog.dashboard_id == dashboard_id)
    return q.order_by(AccessLog.created_at.desc()).limit(limit).all()
