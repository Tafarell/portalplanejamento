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


@router.post("/discover-schema")
def discover_schema_endpoint(db: Session = Depends(get_db),
                             current_user: User = Depends(get_current_user)):
    """
    Descobre schema completo via Scanner Admin API (tabelas + colunas + medidas).
    Requer: 'Allow service principals to use read-only Power BI admin APIs' habilitado no tenant.
    Apenas admin.
    """
    _require_admin(current_user)
    conn = db.query(PBIConnection).filter(PBIConnection.is_active == True).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Nenhuma conexão configurada.")
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
        "scanner_error": result.get("scanner_error"),
    }


class ExploreTablesIn(BaseModel):
    table_names: List[str]


class VerifyMeasureIn(BaseModel):
    measure_name: str          # ex: "Total Ligações"
    table_name:   Optional[str] = None  # ex: "fBaseGeral" (opcional, para schema)


@router.post("/verify-measure")
def verify_measure(data: VerifyMeasureIn,
                   db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    """
    Verifica se uma medida existe via EVALUATE ROW e, se válida,
    adiciona ao schema_context da conexão ativa. Apenas admin.
    """
    _require_admin(current_user)

    conn = db.query(PBIConnection).filter(PBIConnection.is_active == True).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Nenhuma conexão configurada.")

    name = data.measure_name.strip().strip("[]")
    try:
        token  = get_pbi_token(conn.tenant_id, conn.client_id, conn.client_secret)
        result = execute_dax_query(
            conn.dataset_id,
            f'EVALUATE ROW("v", [{name}])',
            token, conn.workspace_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if result.get("error"):
        return {"exists": False, "measure": name, "error": result["error"]}

    # Adiciona ao schema_context preservando o texto existente
    schema = conn.schema_context or ""
    entry  = f"[{name}]"
    if entry not in schema:
        # Insere numa linha "Medidas adicionadas manualmente:"
        marker = "\n\n# Medidas verificadas:"
        if marker in schema:
            schema += f", {entry}"
        else:
            schema += f"{marker}\n{entry}"
        conn.schema_context = schema
        db.commit()

    return {"exists": True, "measure": name, "added": entry not in (conn.schema_context or "")}


@router.delete("/measure/{measure_name}")
def remove_measure(measure_name: str,
                   db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    """Remove uma medida do schema_context. Apenas admin."""
    _require_admin(current_user)
    conn = db.query(PBIConnection).filter(PBIConnection.is_active == True).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Nenhuma conexão configurada.")
    schema = conn.schema_context or ""
    entry  = f"[{measure_name.strip().strip('[]')}]"
    conn.schema_context = schema.replace(f", {entry}", "").replace(entry, "").strip()
    db.commit()
    return {"ok": True}


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


@router.get("/fabric-models")
def list_fabric_models(db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    """Lista os Semantic Models do workspace via Fabric API. Apenas admin."""
    _require_admin(current_user)
    conn = db.query(PBIConnection).filter(PBIConnection.is_active == True).first()
    if not conn or not conn.workspace_id:
        raise HTTPException(status_code=404, detail="Conexão ou Workspace ID não configurado.")
    try:
        import httpx as _httpx
        token = _get_token(conn.tenant_id, conn.client_id, conn.client_secret,
                           "https://api.fabric.microsoft.com/.default")
        url = f"{FABRIC_BASE_URL}/workspaces/{conn.workspace_id}/semanticmodels"
        resp = _httpx.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=30)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=resp.text[:400])
        return resp.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/discover-schema-fabric")
def discover_schema_fabric_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Busca a definição completa do Semantic Model via Fabric REST API.
    Retorna tabelas, colunas E medidas. Salva automaticamente. Apenas admin.
    """
    _require_admin(current_user)

    conn = db.query(PBIConnection).filter(PBIConnection.is_active == True).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Nenhuma conexão configurada.")
    if not conn.workspace_id:
        raise HTTPException(status_code=422, detail="Workspace ID é obrigatório para a Fabric API.")

    try:
        result = discover_schema_fabric(
            workspace_id=conn.workspace_id,
            dataset_id=conn.dataset_id,
            tenant_id=conn.tenant_id,
            client_id=conn.client_id,
            client_secret=conn.client_secret,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if result.get("error"):
        raise HTTPException(status_code=422, detail=result["error"])

    conn.schema_context = result["schema_text"]
    db.commit()

    # Conta tabelas e medidas no texto gerado
    lines = result["schema_text"].splitlines()
    table_count   = sum(1 for l in lines if l.startswith("Tabela:"))
    measure_count = sum(l.count("[") for l in lines if "Medidas:" in l)

    return {
        "ok": True,
        "schema_text": result["schema_text"],
        "table_count": table_count,
        "measure_count": measure_count,
    }
