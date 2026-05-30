from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.database import get_db
from app.models.dashboard import Dashboard
from app.models.permission import Permission, PermissionScope
from app.models.access_log import AccessLog
from app.models.user import User, UserRole
from app.models.pbi_connection import PBIConnection
from app.models.contrato import Contrato
from app.utils.security import get_current_user
from app.services.ai_service import chat_with_ai, chat_with_powerbi, chat_with_multi_powerbi

router = APIRouter(prefix="/api/ai", tags=["Assistente IA"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    question: str
    dashboard_id:      Optional[int] = None
    pbi_connection_id: Optional[int] = None   # qual conexão PBI usar
    conversation_history: Optional[List[ChatMessage]] = []


class ChatResponse(BaseModel):
    answer: str
    dashboard_name:    Optional[str] = None
    pbi_active:        bool = False
    pbi_queries:       Optional[List[str]] = []
    needs_connection:  bool = False            # frontend deve pedir seleção
    connections:       Optional[List[dict]] = []  # lista para o seletor


def _get_allowed_contracts(db: Session, user: User) -> Optional[List[str]]:
    """
    Retorna lista de nomes de contratos que o usuário pode acessar.
    None = admin (sem restrição).
    """
    if user.role == UserRole.ADMIN:
        return None  # sem restrição

    perms = db.query(Permission).filter(
        Permission.user_id == user.id,
        Permission.can_view == True,
    ).all()

    contract_names = set()
    for p in perms:
        if p.scope == PermissionScope.CONTRATO and p.contrato_id:
            c = db.query(Contrato).filter(Contrato.id == p.contrato_id).first()
            if c:
                contract_names.add(c.name)
        elif p.scope == PermissionScope.GRUPO and p.grupo_id:
            # acesso ao grupo inteiro → todos contratos do grupo
            contracts = db.query(Contrato).filter(Contrato.grupo_id == p.grupo_id).all()
            for c in contracts:
                contract_names.add(c.name)

    return list(contract_names) if contract_names else []


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest, db: Session = Depends(get_db),
         current_user: User = Depends(get_current_user)):

    if not current_user.can_use_ai and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Acesso ao Assistente IA não autorizado")

    history = [{"role": m.role, "content": m.content} for m in (request.conversation_history or [])]

    # ── Verifica conexões Power BI disponíveis ────────────────────────────────
    all_conns = db.query(PBIConnection).filter(PBIConnection.is_active == True).all()

    if all_conns:
        # Seleciona a conexão certa
        if request.pbi_connection_id:
            pbi_conn = next((c for c in all_conns if c.id == request.pbi_connection_id), None)
            if not pbi_conn:
                raise HTTPException(status_code=404, detail="Conexão Power BI não encontrada")
        elif len(all_conns) == 1:
            pbi_conn = all_conns[0]
        else:
            # Múltiplas conexões, nenhuma selecionada → pede ao frontend
            return ChatResponse(
                answer="",
                pbi_active=True,
                needs_connection=True,
                connections=[{"id": c.id, "name": c.name, "description": c.description or ""} for c in all_conns],
            )

        # ── Permissões por contrato ───────────────────────────────────────────
        allowed_contracts = _get_allowed_contracts(db, current_user)

        if allowed_contracts is not None and len(allowed_contracts) == 0:
            return ChatResponse(
                answer="⚠️ Você não possui permissão para acessar nenhum contrato. Entre em contato com o administrador.",
                pbi_active=True,
            )

        try:
            if len(all_conns) > 1:
                # Múltiplas conexões: IA escolhe qual usar
                conns_data = [
                    {
                        "id": c.id, "name": c.name,
                        "description": c.description or "",
                        "dataset_id": c.dataset_id,
                        "workspace_id": c.workspace_id,
                        "tenant_id": c.tenant_id,
                        "client_id": c.client_id,
                        "client_secret": c.client_secret,
                        "schema_context": c.schema_context,
                        "measures_context": getattr(c, 'measures_context', None),
                    }
                    for c in all_conns
                ]
                result = chat_with_multi_powerbi(
                    question=request.question,
                    connections=conns_data,
                    allowed_contracts=allowed_contracts,
                    conversation_history=history,
                )
            else:
                schema = "\n\n".join(filter(None, [
                    pbi_conn.schema_context,
                    getattr(pbi_conn, 'measures_context', None),
                ]))
                result = chat_with_powerbi(
                    question=request.question,
                    dataset_id=pbi_conn.dataset_id,
                    workspace_id=pbi_conn.workspace_id,
                    tenant_id=pbi_conn.tenant_id,
                    client_id=pbi_conn.client_id,
                    client_secret=pbi_conn.client_secret,
                    schema_context=schema,
                    allowed_contracts=allowed_contracts,
                    conversation_history=history,
                )
        except Exception as e:
            import traceback
            print("ERRO AI CHAT:", traceback.format_exc())
            raise HTTPException(status_code=500, detail=f"Erro ao consultar Power BI: {str(e)}")

        _log(db, current_user.id, request.dashboard_id, request.question)
        return ChatResponse(
            answer=result["answer"],
            pbi_active=True,
            pbi_queries=result.get("pbi_queries", []),
        )

    # ── Modo padrão: Parquet / DAX context estático ───────────────────────────
    dashboard = None
    parquet_path = None
    dax_context = None

    if request.dashboard_id:
        dashboard = db.query(Dashboard).filter(Dashboard.id == request.dashboard_id).first()
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard não encontrado")

        if current_user.role != UserRole.ADMIN and not dashboard.is_public:
            has_perm = db.query(Permission).filter(
                Permission.user_id == current_user.id,
                Permission.dashboard_id == request.dashboard_id,
                Permission.can_view == True,
            ).first()
            if not has_perm:
                raise HTTPException(status_code=403, detail="Sem permissão de acesso a este dashboard")

        parquet_path = dashboard.parquet_file
        dax_context = dashboard.dax_context

    try:
        answer = chat_with_ai(
            question=request.question,
            dashboard_name=dashboard.name if dashboard else None,
            parquet_path=parquet_path,
            dax_context=dax_context,
            conversation_history=history,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no assistente de IA: {str(e)}")

    _log(db, current_user.id, request.dashboard_id, request.question)
    return ChatResponse(
        answer=answer,
        dashboard_name=dashboard.name if dashboard else None,
        pbi_active=False,
    )


def _log(db: Session, user_id: int, dashboard_id: Optional[int], question: str):
    log = AccessLog(
        user_id=user_id,
        dashboard_id=dashboard_id,
        action="ai_query",
        detail=question[:200],
    )
    db.add(log)
    db.commit()
