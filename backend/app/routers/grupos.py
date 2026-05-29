from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.client import Grupo
from app.schemas.grupo import GrupoCreate, GrupoUpdate, GrupoOut
from app.utils.security import require_admin
from app.services import storage_service

router = APIRouter(prefix="/api/grupos", tags=["Grupos"])

@router.get("/", response_model=List[GrupoOut])
def list_grupos(db: Session = Depends(get_db), admin=Depends(require_admin)):
    return db.query(Grupo).order_by(Grupo.name).all()

@router.post("/", response_model=GrupoOut)
def create_grupo(data: GrupoCreate, db: Session = Depends(get_db), admin=Depends(require_admin)):
    grupo = Grupo(**data.model_dump())
    db.add(grupo)
    db.commit()
    db.refresh(grupo)
    return grupo

@router.get("/{grupo_id}", response_model=GrupoOut)
def get_grupo(grupo_id: int, db: Session = Depends(get_db), admin=Depends(require_admin)):
    grupo = db.query(Grupo).filter(Grupo.id == grupo_id).first()
    if not grupo:
        raise HTTPException(status_code=404, detail="Grupo não encontrado")
    return grupo

@router.put("/{grupo_id}", response_model=GrupoOut)
def update_grupo(grupo_id: int, data: GrupoUpdate, db: Session = Depends(get_db), admin=Depends(require_admin)):
    grupo = db.query(Grupo).filter(Grupo.id == grupo_id).first()
    if not grupo:
        raise HTTPException(status_code=404, detail="Grupo não encontrado")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(grupo, field, value)
    db.commit()
    db.refresh(grupo)
    return grupo

@router.delete("/{grupo_id}")
def delete_grupo(grupo_id: int, db: Session = Depends(get_db), admin=Depends(require_admin)):
    grupo = db.query(Grupo).filter(Grupo.id == grupo_id).first()
    if not grupo:
        raise HTTPException(status_code=404, detail="Grupo não encontrado")
    db.delete(grupo)
    db.commit()
    return {"message": "Grupo removido"}

@router.post("/{grupo_id}/logo")
async def upload_logo(grupo_id: int, file: UploadFile = File(...),
                      db: Session = Depends(get_db), admin=Depends(require_admin)):
    grupo = db.query(Grupo).filter(Grupo.id == grupo_id).first()
    if not grupo:
        raise HTTPException(status_code=404, detail="Grupo não encontrado")
    ext = file.filename.rsplit(".", 1)[-1]
    filename = f"grupo_{grupo_id}.{ext}"
    file_bytes = await file.read()
    public_url = storage_service.upload_client_logo(file_bytes, filename)
    grupo.logo_url = public_url
    db.commit()
    return {"logo_url": public_url}
