from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.database import get_db
from app.models.pbi_connection import PBIConnection
from app.models.user import User, UserRole
from app.utils.security import get_current_user
from app.services.powerbi_service import (
    get_pbi_token, test_connection as pbi_test_connection,
    execute_dax_query, explore_tables_columns, discover_schema_fabric,
    discover_schema as pbi_discover_schema,
    discover_schema_scanner, discover_schema_auto,
    _get_token, FABRIC_BASE_URL,
)

router = APIRouter(prefix="/api/powerbi", tags=["Power BI"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class PBIConnectionIn(BaseModel):
    name:             str = "Conexão Power BI"
    description:      Optional[str] = None
    dataset_id:       str
    workspace_id:     Optional[str] = None
    tenant_id:        str
    client_id:        str
    client_secret:    str = ""
    schema_context:   Optional[str] = None
    measures_context: Optional[str] = None
    is_active:        bool = True

class PBIConnectionOut(BaseModel):
    id:               int
    name:             str
    description:      Optional[str] = None
    dataset_id:       str
    workspace_id:     Optional[str] = None
    tenant_id:        str
    client_id:        str
    schema_context:   Optional[str] = None
    measures_context: Optional[str] = None
    is_active:        bool

    class Config:
        from_attributes = True

class TestResult(BaseModel):
    ok:     bool
    schema: Optional[str] = None
    error:  Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_admin(current_user: User):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")

def _get_conn(db: Session, conn_id: int) -> PBIConnection:
    conn = db.query(PBIConnection).filter(PBIConnection.id == conn_id).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Conexão não encontrada")
    return conn


# ── Rotas ─────────────────────────────────────────────────────────────────────

@router.get("/connections", response_model=List[PBIConnectionOut])
def list_connections(db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    """Retorna conexoes - admin ve todas, usuario ve apenas as permitidas."""
    from app.models.user_pbi_connection import UserPBIConnection
    all_conns = db.query(PBIConnection).filter(PBIConnection.is_active == True).order_by(PBIConnection.id).all()
    if current_user.role.value == 'admin':
        return all_conns
    allowed_ids = {l.connection_id for l in db.query(UserPBIConnection).filter(UserPBIConnection.user_id == current_user.id).all()}
    if not allowed_ids:
        return all_conns
    return [c for c in all_conns if c.id in allowed_ids]


@router.get("/connection", response_model=Optional[PBIConnectionOut])
def get_connection(db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    """Retorna a primeira conexão ativa (compatibilidade)."""
    return db.query(PBIConnection).filter(PBIConnection.is_active == True).first()


@router.post("/connection", response_model=PBIConnectionOut)
def create_connection(data: PBIConnectionIn,
                      db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    """Cria uma nova conexão Power BI. Apenas admin."""
    _require_admin(current_user)
    conn = PBIConnection(**data.dict())
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return conn


@router.put("/connection/{conn_id}", response_model=PBIConnectionOut)
def update_connection(conn_id: int, data: PBIConnectionIn,
                      db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    """Atualiza uma conexão existente. Apenas admin."""
    _require_admin(current_user)
    conn = _get_conn(db, conn_id)
    update = data.dict()
    if not update.get("client_secret"):
        update.pop("client_secret")
    for k, v in update.items():
        setattr(conn, k, v)
    db.commit()
    db.refresh(conn)
    return conn


@router.delete("/connection/{conn_id}")
def delete_connection(conn_id: int,
                      db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    """Remove uma conexão Power BI. Apenas admin."""
    _require_admin(current_user)
    conn = _get_conn(db, conn_id)
    db.delete(conn)
    db.commit()
    return {"ok": True}


@router.post("/test/{conn_id}", response_model=TestResult)
def test_connection(conn_id: int,
                    db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    """Testa uma conexão: obtém token + DAX. Apenas admin."""
    _require_admin(current_user)
    conn = _get_conn(db, conn_id)
    try:
        token  = get_pbi_token(conn.tenant_id, conn.client_id, conn.client_secret)
        result = pbi_test_connection(conn.dataset_id, token, conn.workspace_id)
        if result["ok"]:
            return TestResult(ok=True, schema="✅ Conexão DAX bem-sucedida! Dataset acessível.")
        return TestResult(ok=False, error=result["error"])
    except Exception as e:
        return TestResult(ok=False, error=str(e))


@router.get("/schema/{conn_id}")
def get_schema(conn_id: int,
               db: Session = Depends(get_db),
               current_user: User = Depends(get_current_user)):
    conn = _get_conn(db, conn_id)
    return {"schema": conn.schema_context or ""}


@router.post("/discover-schema/{conn_id}")
def discover_schema_endpoint(conn_id: int,
                              db: Session = Depends(get_db),
                              current_user: User = Depends(get_current_user)):
    _require_admin(current_user)
    conn = _get_conn(db, conn_id)
    if not conn.workspace_id:
        raise HTTPException(status_code=422, detail="Workspace ID é obrigatório para o Scanner API.")
    try:
        result = discover_schema_auto(
            workspace_id=conn.workspace_id,
            dataset_id=conn.dataset_id,
            tenant_id=conn.tenant_id,
            client_id=conn.client_id,
            client_secret=conn.client_secret,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    if result.get("error") == "ADMIN_API_REQUIRED":
        return {"ok": False, "needs_tables": True, "scanner_error": result.get("scanner_error", "")}
    if result.get("error"):
        raise HTTPException(status_code=422, detail=result["error"])
    conn.schema_context = result["schema_text"]
    db.commit()
    return {
        "ok": True,
        "schema_text":   result["schema_text"],
        "table_count":   result.get("table_count", 0),
        "measure_count": result.get("measure_count", 0),
        "fallback":      result.get("fallback", False),
    }


class ExploreTablesIn(BaseModel):
    table_names: List[str]

class VerifyMeasureIn(BaseModel):
    measure_name: str
    table_name:   Optional[str] = None


@router.post("/explore-tables/{conn_id}")
def explore_tables_endpoint(conn_id: int, data: ExploreTablesIn,
                             db: Session = Depends(get_db),
                             current_user: User = Depends(get_current_user)):
    _require_admin(current_user)
    conn = _get_conn(db, conn_id)
    if not data.table_names:
        raise HTTPException(status_code=422, detail="Informe ao menos uma tabela.")
    try:
        token  = get_pbi_token(conn.tenant_id, conn.client_id, conn.client_secret)
        result = explore_tables_columns(conn.dataset_id, token, data.table_names, conn.workspace_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"ok": True, "schema_text": result["schema_text"], "tables_found": result["tables_found"], "errors": result["errors"]}


@router.post("/discover-schema-fabric/{conn_id}")
def discover_schema_fabric_endpoint(conn_id: int,
                                     db: Session = Depends(get_db),
                                     current_user: User = Depends(get_current_user)):
    _require_admin(current_user)
    conn = _get_conn(db, conn_id)
    if not conn.workspace_id:
        raise HTTPException(status_code=422, detail="Workspace ID é obrigatório para a Fabric API.")
    try:
        result = discover_schema_fabric(
            workspace_id=conn.workspace_id, dataset_id=conn.dataset_id,
            tenant_id=conn.tenant_id, client_id=conn.client_id, client_secret=conn.client_secret,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    if result.get("error"):
        raise HTTPException(status_code=422, detail=result["error"])
    conn.schema_context = result["schema_text"]
    db.commit()
    lines = result["schema_text"].splitlines()
    return {"ok": True, "schema_text": result["schema_text"],
            "table_count": sum(1 for l in lines if l.startswith("Tabela:")),
            "measure_count": sum(l.count("[") for l in lines if "Medidas:" in l)}
