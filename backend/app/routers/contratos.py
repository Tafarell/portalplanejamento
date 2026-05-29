from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app.database import get_db
from app.models.contrato import Contrato
from app.schemas.contrato import ContratoCreate, ContratoUpdate, ContratoOut
from app.utils.security import require_admin

router = APIRouter(prefix="/api/contratos", tags=["Contratos"])

@router.get("/", response_model=List[ContratoOut])
def list_contratos(grupo_id: Optional[int] = None, db: Session = Depends(get_db), admin=Depends(require_admin)):
    q = db.query(Contrato).options(joinedload(Contrato.grupo))
    if grupo_id:
        q = q.filter(Contrato.grupo_id == grupo_id)
    contratos = q.order_by(Contrato.name).all()
    result = []
    for c in contratos:
        out = ContratoOut.model_validate(c)
        out.grupo_name = c.grupo.name if c.grupo else None
        result.append(out)
    return result

@router.post("/", response_model=ContratoOut)
def create_contrato(data: ContratoCreate, db: Session = Depends(get_db), admin=Depends(require_admin)):
    contrato = Contrato(**data.model_dump())
    db.add(contrato)
    db.commit()
    db.refresh(contrato)
    db.refresh(contrato, ['grupo'])
    out = ContratoOut.model_validate(contrato)
    out.grupo_name = contrato.grupo.name if contrato.grupo else None
    return out

@router.get("/{contrato_id}", response_model=ContratoOut)
def get_contrato(contrato_id: int, db: Session = Depends(get_db), admin=Depends(require_admin)):
    contrato = db.query(Contrato).options(joinedload(Contrato.grupo)).filter(Contrato.id == contrato_id).first()
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato não encontrado")
    out = ContratoOut.model_validate(contrato)
    out.grupo_name = contrato.grupo.name if contrato.grupo else None
    return out

@router.put("/{contrato_id}", response_model=ContratoOut)
def update_contrato(contrato_id: int, data: ContratoUpdate, db: Session = Depends(get_db), admin=Depends(require_admin)):
    contrato = db.query(Contrato).filter(Contrato.id == contrato_id).first()
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato não encontrado")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(contrato, field, value)
    db.commit()
    db.refresh(contrato)
    out = ContratoOut.model_validate(contrato)
    out.grupo_name = contrato.grupo.name if contrato.grupo else None
    return out

@router.delete("/{contrato_id}")
def delete_contrato(contrato_id: int, db: Session = Depends(get_db), admin=Depends(require_admin)):
    contrato = db.query(Contrato).filter(Contrato.id == contrato_id).first()
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato não encontrado")
    db.delete(contrato)
    db.commit()
    return {"message": "Contrato removido"}
