import json
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

PBI_SYSTEM_PROMPT = """Você é um assistente de Business Intelligence conectado ao Power BI.

Você pode executar consultas DAX no dataset para buscar dados em tempo real e responder perguntas analíticas.

## Como usar a ferramenta query_powerbi:
- Escreva DAX válido baseado no esquema do dataset fornecido abaixo
- Use EVALUATE + SUMMARIZECOLUMNS, TOPN, FILTER, ADDCOLUMNS, etc.
- Para totais simples: EVALUATE ROW("Total", [NomeDaMedida])
- Para tabelas: EVALUATE SUMMARIZECOLUMNS(Tabela[Coluna], "Alias", [Medida])
- Se uma query falhar, tente reformulá-la de forma mais simples
- Execute quantas queries forem necessárias para responder completamente

## Formatação:
- Apresente tabelas em markdown quando houver múltiplas colunas
- Destaque valores importantes em **negrito**
- Calcule variações percentuais quando relevante
- Seja objetivo e direto

{schema}"""

# Definição da ferramenta para tool calling
_PBI_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "query_powerbi",
            "description": "Executa uma consulta DAX no dataset do Power BI conectado e retorna os dados em formato tabular.",
            "parameters": {
                "type": "object",
                "properties": {
                    "dax_query": {
                        "type": "string",
                        "description": "Consulta DAX válida. Deve começar com EVALUATE. Ex: EVALUATE SUMMARIZECOLUMNS(Vendas[Produto], \"Total\", SUM(Vendas[Valor]))"
                    }
                },
                "required": ["dax_query"]
            }
        }
    }
]


def read_parquet_summary(parquet_path: str, max_rows: int = 500) -> str:
    """Baixa o Parquet do Supabase Storage e retorna um resumo estruturado para o LLM."""
    try:
        buf = download_parquet(parquet_path)
        df = pd.read_parquet(buf)

        summary_parts = [
            "### Dados do Dashboard",
            f"**Colunas:** {', '.join(df.columns.tolist())}",
            f"**Total de registros:** {len(df):,}",
            "",
            "**Estatísticas numéricas:**",
            df.describe().to_string(),
            "",
            f"**Amostra dos dados (primeiras {min(max_rows, len(df))} linhas):**",
            df.head(max_rows).to_string(index=False)
        ]

        for col in df.columns:
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                summary_parts.append(f"**Período ({col}):** {df[col].min()} a {df[col].max()}")

        return "\n".join(summary_parts)
    except Exception as e:
        return f"Erro ao ler arquivo de dados: {str(e)}"


def chat_with_ai(question: str, dashboard_name: str = None,
                 parquet_path: str = None, dax_context: str = None,
                 conversation_history: list = None) -> str:
    """Chat padrão sem Power BI (usa Parquet/DAX context estático)."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

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

    if conversation_history:
        for msg in conversation_history[-10:]:
            messages.append(msg)

    messages.append({"role": "user", "content": question})

    response = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=messages,
        temperature=0.3,
        max_tokens=2000
    )

    return response.choices[0].message.content


def chat_with_powerbi(
    question: str,
    dataset_id: str,
    tenant_id: str,
    client_id: str,
    client_secret: str,
    workspace_id: str = None,
    schema_context: str = None,
    conversation_history: list = None,
    max_tool_iterations: int = 4,
) -> dict:
    """
    Chat com suporte a tool calling no Power BI.

    Retorna:
        {
            "answer": str,          # resposta final da IA
            "pbi_queries": list[str] # queries DAX executadas
        }
    """
    from app.services.powerbi_service import (
        get_pbi_token, get_dataset_schema, execute_dax_query, format_rows_for_llm
    )

    # 1. Token + schema
    token = get_pbi_token(tenant_id, client_id, client_secret)

    schema = schema_context or "Schema não fornecido — explore as tabelas com DAX (ex: EVALUATE TOPN(5, NomeDaTabela)) para descobrir os dados disponíveis."
    system_content = PBI_SYSTEM_PROMPT.format(schema=schema)

    messages = [{"role": "system", "content": system_content}]

    if conversation_history:
        for msg in conversation_history[-10:]:
            messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": question})

    pbi_queries: list[str] = []

    # 2. Loop de tool calling
    for _ in range(max_tool_iterations):
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=messages,
            tools=_PBI_TOOLS,
            tool_choice="auto",
            temperature=0.1,
            max_tokens=3000,
        )

        msg = response.choices[0].message

        # Sem tool call → resposta final
        if not msg.tool_calls:
            return {"answer": msg.content or "", "pbi_queries": pbi_queries}

        # Processa tool calls (normalmente só 1 por vez)
        messages.append(msg)  # adiciona a mensagem do assistant com tool_calls

        for tool_call in msg.tool_calls:
            try:
                args = json.loads(tool_call.function.arguments)
                dax = args.get("dax_query", "")
            except Exception:
                dax = ""

            pbi_queries.append(dax)

            # Executa o DAX
            result = execute_dax_query(dataset_id, dax, token, workspace_id)
            formatted = format_rows_for_llm(result)

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": formatted,
            })

    # Fallback: força resposta final sem tools
    response = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=messages,
        temperature=0.1,
        max_tokens=3000,
    )
    return {
        "answer": response.choices[0].message.content or "",
        "pbi_queries": pbi_queries,
    }
