import pandas as pd
from openai import OpenAI
from app.config import settings
from app.services.storage_service import download_parquet

# Suporte a OpenRouter e OpenAI — configurado via OPENAI_BASE_URL
_client_kwargs = {"api_key": settings.OPENAI_API_KEY}
if settings.OPENAI_BASE_URL:
    _client_kwargs["base_url"] = settings.OPENAI_BASE_URL

client = OpenAI(**_client_kwargs)

SYSTEM_PROMPT = """Você é um assistente de Business Intelligence especializado em análise de dados.
Você tem acesso a dados de dashboards empresariais e pode responder perguntas sobre indicadores,
faturamento, contratos, desempenho e outros KPIs de negócio.

Ao analisar dados:
- Seja preciso e objetivo nas respostas
- Calcule percentuais, variações e comparações quando solicitado
- Destaque principais insights e anomalias
- Explique métricas em linguagem acessível
- Sugira próximas análises quando relevante
- Use formatação clara com valores e percentuais

Se não tiver dados suficientes, informe ao usuário e sugira o que seria necessário para responder."""

def read_parquet_summary(parquet_path: str, max_rows: int = 500) -> str:
    """Baixa o Parquet do Supabase Storage e retorna um resumo estruturado para o LLM."""
    try:
        buf = download_parquet(parquet_path)
        df = pd.read_parquet(buf)
        
        summary_parts = [
            f"### Dados do Dashboard",
            f"**Colunas:** {', '.join(df.columns.tolist())}",
            f"**Total de registros:** {len(df):,}",
            "",
            "**Estatísticas numéricas:**",
            df.describe().to_string(),
            "",
            f"**Amostra dos dados (primeiras {min(max_rows, len(df))} linhas):**",
            df.head(max_rows).to_string(index=False)
        ]
        
        # Detecta colunas de data e adiciona range
        for col in df.columns:
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                summary_parts.append(f"**Período ({col}):** {df[col].min()} a {df[col].max()}")
        
        return "\n".join(summary_parts)
    except Exception as e:
        return f"Erro ao ler arquivo de dados: {str(e)}"

def chat_with_ai(question: str, dashboard_name: str = None,
                 parquet_path: str = None, dax_context: str = None,
                 conversation_history: list = None) -> str:
    """Envia pergunta ao GPT-4 com contexto de dados."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    
    # Adiciona contexto do dashboard
    context_parts = []
    if dashboard_name:
        context_parts.append(f"**Dashboard:** {dashboard_name}")
    if dax_context:
        context_parts.append(f"**Regras de negócio e métricas DAX:**\n{dax_context}")
    if parquet_path:
        context_parts.append(read_parquet_summary(parquet_path))
    
    if context_parts:
        messages.append({
            "role": "system",
            "content": "## Contexto dos dados disponíveis:\n\n" + "\n\n".join(context_parts)
        })
    
    # Histórico da conversa
    if conversation_history:
        for msg in conversation_history[-10:]:  # últimas 10 mensagens
            messages.append(msg)
    
    messages.append({"role": "user", "content": question})
    
    response = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=messages,
        temperature=0.3,
        max_tokens=2000
    )
    
    return response.choices[0].message.content
