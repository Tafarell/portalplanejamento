from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.client import Client
from app.schemas.client import ClientCreate, ClientUpdate, ClientOut
from app.utils.security import require_admin
from app.services import storage_service

router = APIRouter(prefix="/api/clients", tags=["Clientes"])

@router.get("/", response_model=List[ClientOut])
def list_clients(db: Session = Depends(get_db), admin=Depends(require_admin)):
    return db.query(Client).order_by(Client.name).all()

@router.post("/", response_model=ClientOut)
def create_client(data: ClientCreate, db: Session = Depends(get_db), admin=Depends(require_admin)):
    client = Client(**data.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    return client

@router.get("/{client_id}", response_model=ClientOut)
def get_client(client_id: int, db: Session = Depends(get_db), admin=Depends(require_admin)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return client

@router.put("/{client_id}", response_model=ClientOut)
def update_client(client_id: int, data: ClientUpdate, db: Session = Depends(get_db), admin=Depends(require_admin)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(client, field, value)
    db.commit()
    db.refresh(client)
    return client

@router.delete("/{client_id}")
def delete_client(client_id: int, db: Session = Depends(get_db), admin=Depends(require_admin)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    db.delete(client)
    db.commit()
    return {"message": "Cliente removido"}

@router.post("/{client_id}/logo")
async def upload_logo(client_id: int, file: UploadFile = File(...),
                      db: Session = Depends(get_db), admin=Depends(require_admin)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    ext = file.filename.rsplit(".", 1)[-1]
    filename = f"client_{client_id}.{ext}"
    file_bytes = await file.read()
    public_url = storage_service.upload_client_logo(file_bytes, filename)
    client.logo_url = public_url
    db.commit()
    return {"logo_url": public_url}
