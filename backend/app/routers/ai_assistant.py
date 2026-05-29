from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.database import get_db
from app.models.dashboard import Dashboard
from app.models.permission import Permission
from app.models.access_log import AccessLog
from app.models.user import User, UserRole
from app.models.pbi_connection import PBIConnection
from app.utils.security import get_current_user
from app.services.ai_service import chat_with_ai, chat_with_powerbi

router = APIRouter(prefix="/api/ai", tags=["Assistente IA"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    question: str
    dashboard_id: Optional[int] = None
    conversation_history: Optional[List[ChatMessage]] = []


class ChatResponse(BaseModel):
    answer: str
    dashboard_name: Optional[str] = None
    pbi_active: bool = False
    pbi_queries: Optional[List[str]] = []


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest, db: Session = Depends(get_db),
         current_user: User = Depends(get_current_user)):

    if not current_user.can_use_ai and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Acesso ao Assistente IA não autorizado")

    history = [{"role": m.role, "content": m.content} for m in (request.conversation_history or [])]

    # Verifica se há conexão Power BI ativa
    pbi_conn = db.query(PBIConnection).filter(PBIConnection.is_active == True).first()

    if pbi_conn:
        # ── Modo Power BI: tool calling com DAX ──────────────────────────────
        try:
            result = chat_with_powerbi(
                question=request.question,
                dataset_id=pbi_conn.dataset_id,
                tenant_id=pbi_conn.tenant_id,
                client_id=pbi_conn.client_id,
                client_secret=pbi_conn.client_secret,
                conversation_history=history,
            )
        except Exception as e:
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
