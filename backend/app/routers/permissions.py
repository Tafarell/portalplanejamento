from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app.database import get_db
from app.models.permission import Permission, PermissionScope
from app.models.dashboard import Dashboard
from app.models.contrato import Contrato
from app.models.client import Grupo
from app.models.user import User
from app.schemas.permission import PermissionCreate, PermissionOut
from app.utils.security import require_admin

router = APIRouter(prefix="/api/permissions", tags=["Permissões"])

def _enrich_perm(p: Permission) -> PermissionOut:
    out = PermissionOut.model_validate(p)
    if p.user:
        out.user_name = p.user.name
    if p.dashboard:
        out.dashboard_name = p.dashboard.name
    if p.contrato:
        out.contrato_name = p.contrato.name
    if p.grupo:
        out.grupo_name = p.grupo.name
    return out

@router.get("/", response_model=List[PermissionOut])
def list_permissions(
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    admin=Depends(require_admin)
):
    q = db.query(Permission).options(
        joinedload(Permission.user),
        joinedload(Permission.dashboard),
        joinedload(Permission.contrato),
        joinedload(Permission.grupo),
    )
    if user_id:
        q = q.filter(Permission.user_id == user_id)
    return [_enrich_perm(p) for p in q.all()]

@router.post("/", response_model=PermissionOut)
def grant_permission(data: PermissionCreate, db: Session = Depends(get_db), admin=Depends(require_admin)):
    # Verifica duplicata
    q = db.query(Permission).filter(
        Permission.user_id == data.user_id,
        Permission.scope == data.scope
    )
    if data.scope == PermissionScope.DASHBOARD:
        q = q.filter(Permission.dashboard_id == data.dashboard_id)
    elif data.scope == PermissionScope.CONTRATO:
        q = q.filter(Permission.contrato_id == data.contrato_id)
    elif data.scope == PermissionScope.GRUPO:
        q = q.filter(Permission.grupo_id == data.grupo_id)

    existing = q.first()
    if existing:
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(existing, field, value)
        db.commit()
        db.refresh(existing)
        perm = db.query(Permission).options(
            joinedload(Permission.user), joinedload(Permission.dashboard),
            joinedload(Permission.contrato), joinedload(Permission.grupo)
        ).filter(Permission.id == existing.id).first()
        return _enrich_perm(perm)

    perm = Permission(**data.model_dump())
    db.add(perm)
    db.commit()
    db.refresh(perm)
    perm = db.query(Permission).options(
        joinedload(Permission.user), joinedload(Permission.dashboard),
        joinedload(Permission.contrato), joinedload(Permission.grupo)
    ).filter(Permission.id == perm.id).first()
    return _enrich_perm(perm)

@router.delete("/{permission_id}")
def revoke_permission(permission_id: int, db: Session = Depends(get_db), admin=Depends(require_admin)):
    perm = db.query(Permission).filter(Permission.id == permission_id).first()
    if not perm:
        raise HTTPException(status_code=404, detail="Permissão não encontrada")
    db.delete(perm)
    db.commit()
    return {"message": "Permissão revogada"}
