from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import List, Optional
from app.database import get_db
from app.models.dashboard import Dashboard
from app.models.permission import Permission, PermissionScope
from app.models.contrato import Contrato
from app.models.access_log import AccessLog
from app.models.user import User, UserRole
from app.schemas.dashboard import DashboardCreate, DashboardUpdate, DashboardOut
from app.services import storage_service
from app.utils.security import get_current_user, require_admin

router = APIRouter(prefix="/api/dashboards", tags=["Dashboards"])

def _enrich(dashboard: Dashboard) -> DashboardOut:
    out = DashboardOut.model_validate(dashboard)
    if dashboard.contrato:
        out.contrato_name = dashboard.contrato.name
        if dashboard.contrato.grupo:
            out.grupo_name = dashboard.contrato.grupo.name
    return out

def _get_accessible_ids(user: User, db: Session):
    """Retorna set de dashboard_ids acessíveis ao usuário."""
    perms = db.query(Permission).filter(
        Permission.user_id == user.id,
        Permission.can_view == True
    ).all()

    dashboard_ids = set()
    contrato_ids = set()
    grupo_ids = set()

    for p in perms:
        if p.scope == PermissionScope.DASHBOARD and p.dashboard_id:
            dashboard_ids.add(p.dashboard_id)
        elif p.scope == PermissionScope.CONTRATO and p.contrato_id:
            contrato_ids.add(p.contrato_id)
        elif p.scope == PermissionScope.GRUPO and p.grupo_id:
            grupo_ids.add(p.grupo_id)

    # Se usuário tem grupo associado, adiciona como grupo implícito
    if user.client_id:
        grupo_ids.add(user.client_id)

    return dashboard_ids, contrato_ids, grupo_ids

@router.get("/", response_model=List[DashboardOut])
def list_dashboards(
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(Dashboard).options(
        joinedload(Dashboard.contrato).joinedload(Contrato.grupo)
    ).filter(Dashboard.is_active == True)

    if current_user.role != UserRole.ADMIN:
        dashboard_ids, contrato_ids, grupo_ids = _get_accessible_ids(current_user, db)

        # Busca contrato_ids que pertencem aos grupos autorizados
        if grupo_ids:
            grupo_contrato_ids = {c.id for c in db.query(Contrato).filter(Contrato.grupo_id.in_(grupo_ids)).all()}
            contrato_ids |= grupo_contrato_ids

        conditions = [Dashboard.is_public == True]
        if dashboard_ids:
            conditions.append(Dashboard.id.in_(dashboard_ids))
        if contrato_ids:
            conditions.append(Dashboard.contrato_id.in_(contrato_ids))

        q = q.filter(or_(*conditions))

    if category:
        q = q.filter(Dashboard.category == category.lower())
    if search:
        q = q.filter(Dashboard.name.ilike(f"%{search}%"))

    dashboards = q.order_by(Dashboard.name).all()
    return [_enrich(d) for d in dashboards]

@router.get("/admin", response_model=List[DashboardOut])
def list_all_dashboards(db: Session = Depends(get_db), admin=Depends(require_admin)):
    dashboards = db.query(Dashboard).options(
        joinedload(Dashboard.contrato).joinedload(Contrato.grupo)
    ).order_by(Dashboard.name).all()
    return [_enrich(d) for d in dashboards]

@router.post("/", response_model=DashboardOut)
def create_dashboard(data: DashboardCreate, db: Session = Depends(get_db),
                     current_user: User = Depends(require_admin)):
    dashboard = Dashboard(**data.model_dump(), created_by=current_user.id)
    db.add(dashboard)
    db.commit()
    db.refresh(dashboard)
    # reload com joins
    dashboard = db.query(Dashboard).options(
        joinedload(Dashboard.contrato).joinedload(Contrato.grupo)
    ).filter(Dashboard.id == dashboard.id).first()
    return _enrich(dashboard)

@router.get("/{dashboard_id}", response_model=DashboardOut)
def get_dashboard(dashboard_id: int, db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    dashboard = db.query(Dashboard).options(
        joinedload(Dashboard.contrato).joinedload(Contrato.grupo)
    ).filter(Dashboard.id == dashboard_id).first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard não encontrado")

    if current_user.role != UserRole.ADMIN and not dashboard.is_public:
        dashboard_ids, contrato_ids, grupo_ids = _get_accessible_ids(current_user, db)
        if grupo_ids:
            grupo_contrato_ids = {c.id for c in db.query(Contrato).filter(Contrato.grupo_id.in_(grupo_ids)).all()}
            contrato_ids |= grupo_contrato_ids
        has_access = (
            dashboard_id in dashboard_ids or
            (dashboard.contrato_id and dashboard.contrato_id in contrato_ids)
        )
        if not has_access:
            raise HTTPException(status_code=403, detail="Sem permissão de acesso")

    log = AccessLog(user_id=current_user.id, dashboard_id=dashboard_id, action="view_dashboard")
    db.add(log)
    db.commit()
    return _enrich(dashboard)

@router.put("/{dashboard_id}", response_model=DashboardOut)
def update_dashboard(dashboard_id: int, data: DashboardUpdate,
                     db: Session = Depends(get_db), admin=Depends(require_admin)):
    dashboard = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard não encontrado")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(dashboard, field, value)
    db.commit()
    dashboard = db.query(Dashboard).options(
        joinedload(Dashboard.contrato).joinedload(Contrato.grupo)
    ).filter(Dashboard.id == dashboard_id).first()
    return _enrich(dashboard)

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
    try:
        ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
        filename = f"dashboard_{dashboard_id}.{ext}"
        file_bytes = await file.read()
        public_url = storage_service.upload_cover(file_bytes, filename)
        dashboard.cover_image_url = public_url
        db.commit()
        return {"cover_image_url": public_url}
    except Exception as e:
        import traceback
        print("ERRO upload cover:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro ao fazer upload: {str(e)}")

@router.post("/{dashboard_id}/parquet")
async def upload_parquet(dashboard_id: int, file: UploadFile = File(...),
                         db: Session = Depends(get_db), admin=Depends(require_admin)):
    dashboard = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard não enco