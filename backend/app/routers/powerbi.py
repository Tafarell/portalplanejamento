from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.database import get_db
from app.models.pbi_connection import PBIConnection
from app.models.user import User, UserRole
from app.utils.security import get_current_user
from typing import List
from app.services.powerbi_service import get_pbi_token, test_connection as pbi_test_connection, execute_dax_query, explore_tables_columns

router = APIRouter(prefix="/api/powerbi", tags=["Power BI"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class PBIConnectionIn(BaseModel):
    name:           str = "Conexão Power BI"
    dataset_id:     str
    workspace_id:   Optional[str] = None
    tenant_id:      str
    client_id:      str
    client_secret:  str = ""
    schema_context: Optional[str] = None
    is_active:      bool = True

class PBIConnectionOut(BaseModel):
    id:             int
    name:           str
    dataset_id:     str
    workspace_id:   Optional[str] = None
    tenant_id:      str
    client_id:      str
    schema_context: Optional[str] = None
    is_active:      bool
    # client_secret NÃO é retornado por segurança

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


# ── Rotas ─────────────────────────────────────────────────────────────────────

@router.get("/connection", response_model=Optional[PBIConnectionOut])
def get_connection(db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    """Retorna a conexão ativa (se existir). Acessível por todos os usuários autenticados."""
    conn = db.query(PBIConnection).filter(PBIConnection.is_active == True).first()
    return conn  # None se não configurado


@router.post("/connection", response_model=PBIConnectionOut)
def create_or_update_connection(data: PBIConnectionIn,
                                db: Session = Depends(get_db),
                                current_user: User = Depends(get_current_user)):
    """Cria ou substitui a conexão global do Power BI. Apenas admin."""
    _require_admin(current_user)

    existing = db.query(PBIConnection).first()

    if existing:
        # Atualiza campos — preserva client_secret se vier vazio
        update = data.dict()
        if not update.get("client_secret"):
            update.pop("client_secret")
        for k, v in update.items():
            setattr(existing, k, v)
        db.commit()
        db.refresh(existing)
        return existing
    else:
        conn = PBIConnection(**data.dict())
        db.add(conn)
        db.commit()
        db.refresh(conn)
        return conn


@router.delete("/connection")
def delete_connection(db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    """Remove a conexão Power BI. Apenas admin."""
    _require_admin(current_user)
    db.query(PBIConnection).delete()
    db.commit()
    return {"ok": True}


@router.post("/test", response_model=TestResult)
def test_connection(db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    """Testa a conexão atual: obtém token + schema. Apenas admin."""
    _require_admin(current_user)

    conn = db.query(PBIConnection).filter(PBIConnection.is_active == True).first()
    if not conn:
        return TestResult(ok=False, error="Nenhuma conexão configurada.")

    try:
        token  = get_pbi_token(conn.tenant_id, conn.client_id, conn.client_secret)
        result = pbi_test_connection(conn.dataset_id, token, conn.workspace_id)
        if result["ok"]:
            return TestResult(ok=True, schema="✅ Conexão DAX bem-sucedida! Dataset acessível.")
        return TestResult(ok=False, error=result["error"])
    except Exception as e:
        return TestResult(ok=False, error=str(e))


@router.get("/schema")
def get_schema(db: Session = Depends(get_db),
               current_user: User = Depends(get_current_user)):
    """Retorna o schema salvo da conexão ativa."""
    conn = db.query(PBIConnection).filter(PBIConnection.is_active == True).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Power BI não configurado")
    return {"schema": conn.schema_context or ""}


class ExploreTablesIn(BaseModel):
    table_names: List[str]


@router.post("/explore-tables")
def explore_tables_endpoint(data: ExploreTablesIn,
                            db: Session = Depends(get_db),
                            current_user: User = Depends(get_current_user)):
    """
    Para cada tabela informada, executa EVALUATE TOPN(1, Tabela) e extrai colunas.
    Salva o schema_text gerado na conexão ativa. Apenas admin.
    """
    _require_admin(current_user)

    if not data.table_names:
        raise HTTPException(status_code=422, detail="Informe ao menos uma tabela.")

    conn = db.query(PBIConnection).filter(PBIConnection.is_active == True).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Nenhuma conexão configurada.")

    try:
        token  = get_pbi_token(conn.tenant_id, conn.client_id, conn.client_secret)
        result = explore_tables_columns(conn.dataset_id, token, data.table_names, conn.workspace_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Salva automaticamente no banco (merge com o que já existe)
    conn.schema_context = result["schema_text"]
    db.commit()

    return {
        "ok": True,
        "schema_text": result["schema_text"],
        "tables_found": result["tables_found"],
        "errors": result["errors"],
    }
