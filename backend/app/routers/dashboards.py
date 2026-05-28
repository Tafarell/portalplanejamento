from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.dashboard import Dashboard, DashboardCategory
from app.models.permission import Permission
from app.models.access_log import AccessLog
from app.models.user import User, UserRole
from app.schemas.dashboard import DashboardCreate, DashboardUpdate, DashboardOut
from app.services import storage_service
from app.utils.security import get_current_user, require_admin
from app.config import settings

router = APIRouter(prefix="/api/dashboards", tags=["Dashboards"])

@router.get("/", response_model=List[DashboardOut])
def list_dashboards(category: Optional[str] = None, client_id: Optional[int] = None,
                    search: Optional[str] = None,
                    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(Dashboard).filter(Dashboard.is_active == True)

    if current_user.role != UserRole.ADMIN:
        # Filtra apenas dashboards que o usuário tem permissão ou são públicos
        permitted_ids = [p.dashboard_id for p in db.query(Permission)
                         .filter(Permission.user_id == current_user.id, Permission.can_view == True).all()]
        q = q.filter((Dashboard.id.in_(permitted_ids)) | (Dashboard.is_public == True))
        if current_user.client_id:
            q = q.filter((Dashboard.client_id == current_user.client_id) | (Dashboard.client_id == None))

    if category:
        q = q.filter(Dashboard.category == category)
    if client_id:
        q = q.filter(Dashboard.client_id == client_id)
    if search:
        q = q.filter(Dashboard.name.ilike(f"%{search}%"))

    return q.order_by(Dashboard.name).all()

@router.get("/admin", response_model=List[DashboardOut])
def list_all_dashboards(db: Session = Depends(get_db), admin=Depends(require_admin)):
    return db.query(Dashboard).order_by(Dashboard.name).all()

@router.post("/", response_model=DashboardOut)
def create_dashboard(data: DashboardCreate, db: Session = Depends(get_db),
                     current_user: User = Depends(require_admin)):
    dashboard = Dashboard(**data.model_dump(), created_by=current_user.id)
    db.add(dashboard)
    db.commit()
    db.refresh(dashboard)
    return dashboard

@router.get("/{dashboard_id}", response_model=DashboardOut)
def get_dashboard(dashboard_id: int, db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    dashboard = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard não encontrado")
    
    if current_user.role != UserRole.ADMIN and not dashboard.is_public:
        has_perm = db.query(Permission).filter(
            Permission.user_id == current_user.id,
            Permission.dashboard_id == dashboard_id,
            Permission.can_view == True
        ).first()
        if not has_perm:
            raise HTTPException(status_code=403, detail="Sem permissão de acesso")
    
    log = AccessLog(user_id=current_user.id, dashboard_id=dashboard_id, action="view_dashboard")
    db.add(log)
    db.commit()
    return dashboard

@router.put("/{dashboard_id}", response_model=DashboardOut)
def update_dashboard(dashboard_id: int, data: DashboardUpdate,
                     db: Session = Depends(get_db), admin=Depends(require_admin)):
    dashboard = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard não encontrado")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(dashboard, field, value)
    db.commit()
    db.refresh(dashboard)
    return dashboard

@router.delete("/{dashboard_id}")
def delete_dashboard(dashboard_id: int, db: Session = Depends(get_db), admin=Depends(require_admin)):
    dashboard = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard não encontrado")
    db.delete(dashboard)
    db.commit()
    return {"message": "Dashboard removido"}

@router.patch("/{dashboard_id}/toggle")
def toggle_dashboard(dashboard_id: int, db: Session = Depends(get_db), admin=Depends(require_admin)):
    dashboard = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard não encontrado")
    dashboard.is_active = not dashboard.is_active
    db.commit()
    return {"id": dashboard.id, "is_active": dashboard.is_active}

@router.post("/{dashboard_id}/cover")
async def upload_cover(dashboard_id: int, file: UploadFile = File(...),
                       db: Session = Depends(get_db), admin=Depends(require_admin)):
    dashboard = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard não encontrado")
    ext = file.filename.rsplit(".", 1)[-1]
    filename = f"dashboard_{dashboard_id}.{ext}"
    file_bytes = await file.read()
    public_url = storage_service.upload_cover(file_bytes, filename)
    dashboard.cover_image_url = public_url
    db.commit()
    return {"cover_image_url": public_url}

@router.post("/{dashboard_id}/parquet")
async def upload_parquet(dashboard_id: int, file: UploadFile = File(...),
                         db: Session = Depends(get_db), admin=Depends(require_admin)):
    dashboard = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard não encontrado")
    file_bytes = await file.read()
    storage_path = storage_service.upload_parquet(file_bytes, dashboard_id)
    dashboard.parquet_file = storage_path  # armazena path relativo no Supabase Storage
    db.commit()
    return {"message": "Arquivo Parquet enviado com sucesso", "parquet_file": storage_path}
