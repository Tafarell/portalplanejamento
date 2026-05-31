from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate, UserOut
from app.utils.security import hash_password, get_current_user, require_admin

router = APIRouter(prefix="/api/users", tags=["Usuários"])

@router.get("/", response_model=List[UserOut])
def list_users(role: Optional[str] = None, client_id: Optional[int] = None,
               db: Session = Depends(get_db), admin=Depends(require_admin)):
    q = db.query(User)
    if role:
        q = q.filter(User.role == role)
    if client_id:
        q = q.filter(User.client_id == client_id)
    return q.order_by(User.name).all()

@router.post("/", response_model=UserOut)
def create_user(data: UserCreate, db: Session = Depends(get_db), admin=Depends(require_admin)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")
    user = User(name=data.name, email=data.email,
                hashed_password=hash_password(data.password),
                role=data.role, client_id=data.client_id, is_active=data.is_active)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db), admin=Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return user

@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db), admin=Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    for field, value in data.model_dump(exclude_none=True).items():
        if field == "password":
            setattr(user, "hashed_password", hash_password(value))
        else:
            setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), admin=Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    db.delete(user)
    db.commit()
    return {"message": "Usuário removido"}

@router.patch("/{user_id}/toggle")
def toggle_user(user_id: int, db: Session = Depends(get_db), admin=Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    user.is_active = not user.is_active
    db.commit()
    return {"id": user.id, "is_active": user.is_active}


# ── Fontes PBI por usuário ─────────────────────────────────────────────────────

from app.models.pbi_connection import PBIConnection
from app.models.user_pbi_connection import UserPBIConnection

@router.get("/{user_id}/pbi-connections")
def get_user_pbi_connections(user_id: int, db: Session = Depends(get_db),
                              admin=Depends(require_admin)):
    links = db.query(UserPBIConnection).filter(UserPBIConnection.user_id == user_id).all()
    return [l.connection_id for l in links]


@router.put("/{user_id}/pbi-connections")
def set_user_pbi_connections(user_id: int, connection_ids: list[int],
                              db: Session = Depends(get_db), admin=Depends(require_admin)):
    db.query(UserPBIConnection).filter(UserPBIConnection.user_id == user_id).delete()
    for cid in connection_ids:
        db.add(UserPBIConnection(user_id=user_id, connection_id=cid))
    db.commit()
    return {"ok": True}
