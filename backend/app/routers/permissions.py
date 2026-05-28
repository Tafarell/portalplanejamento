from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.permission import Permission
from app.schemas.permission import PermissionCreate, PermissionOut
from app.utils.security import require_admin

router = APIRouter(prefix="/api/permissions", tags=["Permissões"])

@router.get("/", response_model=List[PermissionOut])
def list_permissions(user_id: int = None, dashboard_id: int = None,
                     db: Session = Depends(get_db), admin=Depends(require_admin)):
    q = db.query(Permission)
    if user_id:
        q = q.filter(Permission.user_id == user_id)
    if dashboard_id:
        q = q.filter(Permission.dashboard_id == dashboard_id)
    return q.all()

@router.post("/", response_model=PermissionOut)
def grant_permission(data: PermissionCreate, db: Session = Depends(get_db), admin=Depends(require_admin)):
    existing = db.query(Permission).filter(
        Permission.user_id == data.user_id,
        Permission.dashboard_id == data.dashboard_id
    ).first()
    if existing:
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(existing, field, value)
        db.commit()
        db.refresh(existing)
        return existing
    perm = Permission(**data.model_dump())
    db.add(perm)
    db.commit()
    db.refresh(perm)
    return perm

@router.delete("/{permission_id}")
def revoke_permission(permission_id: int, db: Session = Depends(get_db), admin=Depends(require_admin)):
    perm = db.query(Permission).filter(Permission.id == permission_id).first()
    if not perm:
        raise HTTPException(status_code=404, detail="Permissão não encontrada")
    db.delete(perm)
    db.commit()
    return {"message": "Permissão revogada"}

@router.post("/bulk")
def bulk_grant(user_id: int, dashboard_ids: List[int],
               db: Session = Depends(get_db), admin=Depends(require_admin)):
    created = 0
    for did in dashboard_ids:
        existing = db.query(Permission).filter(
            Permission.user_id == user_id, Permission.dashboard_id == did).first()
        if not existing:
            db.add(Permission(user_id=user_id, dashboard_id=did, can_view=True))
            created += 1
    db.commit()
    return {"message": f"{created} permissões concedidas"}
