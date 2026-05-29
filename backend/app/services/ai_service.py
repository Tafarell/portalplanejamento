import json
import pandas as pd
from openai import OpenAI
from app.config import settings
from app.services.storage_service import download_parquet

# Suporte a OpenRouter e OpenAI
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

PBI_SYSTEM_PROMPT = """Você é um assistente de Business Intelligence conectado ao Power BI em tempo real.

Você executa consultas DAX para buscar dados e responder perguntas analíticas.

## REGRA DE ASPAS — OBRIGATÓRIO:

Qualquer tabela com acento ou caractere especial DEVE ser envolta em aspas simples em TODO contexto DAX:
- Correto: 'dCalendario'[Date]
- Correto: FILTER(ALL('dCalendario'), 'dCalendario'[Date] = ...)
- Correto: 'dHorarioIntervalo'[Intervalo de Hora]
- ERRADO: dCalendario[Date] sem aspas simples causa erro de sintaxe

## REGRA DE FILTRO POR CONTRATO — OBRIGATÓRIO:

A dimensão dGrupoEmpresa identifica o contrato/servico. Coluna-chave:
- secao_resumido -> nome do contrato (ex: "Ligue 180", "Ouvidoria", "Saude da Mulher")

- Se o usuario mencionar um contrato/servico especifico (ex: "Ligue 180", "Ouvidoria"), filtre por dGrupoEmpresa[secao_resumido] = "NomeExato".
- Se o usuario NAO mencionar contrato especifico, NAO adicione filtro de contrato — retorne dados de todos os contratos.
- Administrador pode ver todos os contratos sem restricao.

ALLOWED_CONTRACTS_PLACEHOLDER

## Sintaxe DAX correta:

Total simples:
EVALUATE ROW("Total", [Medida])

Total filtrado por contrato:
EVALUATE CALCULATETABLE(
    ROW("Total", [Chamadas Entrantes]),
    dGrupoEmpresa[secao_resumido] = "NomeDoContrato"
)

Total filtrado por data (ontem) + contrato:
EVALUATE CALCULATETABLE(
    ROW("Total", [Chamadas Entrantes]),
    'dCalendario'[Date] = TODAY() - 1,
    dGrupoEmpresa[secao_resumido] = "NomeDoContrato"
)

Total filtrado por mes atual + contrato:
EVALUATE CALCULATETABLE(
    ROW("Total", [Chamadas Atendidas]),
    MONTH('dCalendario'[Date]) = MONTH(TODAY()),
    YEAR('dCalendario'[Date]) = YEAR(TODAY()),
    dGrupoEmpresa[secao_resumido] = "NomeDoContrato"
)

Tabela agrupada com filtros de data e contrato:
EVALUATE SUMMARIZECOLUMNS(
    'dHorarioIntervalo'[Intervalo de Hora],
    FILTER(ALL('dCalendario'), 'dCalendario'[Date] = TODAY() - 1),
    FILTER(ALL(dGrupoEmpresa), dGrupoEmpresa[secao_resumido] = "NomeDoContrato"),
    "Total", [Chamadas Atendidas]
)

NUNCA use sintaxe invalida:
- SUMMARIZECOLUMNS com igualdade direta: Tabela[Coluna] = valor ERRADO
- Tabelas com acento sem aspas simples: dCalendario sem aspas ERRADO

## Comparacoes de periodo — sintaxe correta:

Esta semana vs semana anterior:
EVALUATE ROW(
    "Esta Semana", CALCULATE([Chamadas Atendidas], WEEKNUM('dCalendario'[Date]) = WEEKNUM(TODAY()), YEAR('dCalendario'[Date]) = YEAR(TODAY())),
    "Semana Anterior", CALCULATE([Chamadas Atendidas], WEEKNUM('dCalendario'[Date]) = WEEKNUM(TODAY()) - 1, YEAR('dCalendario'[Date]) = YEAR(TODAY()))
)

Este mes vs mes anterior:
EVALUATE ROW(
    "Este Mes", CALCULATE([Chamadas Atendidas], MONTH('dCalendario'[Date]) = MONTH(TODAY()), YEAR('dCalendario'[Date]) = YEAR(TODAY())),
    "Mes Anterior", CALCULATE([Chamadas Atendidas], MONTH('dCalendario'[Date]) = MONTH(TODAY()) - 1, YEAR('dCalendario'[Date]) = YEAR(TODAY()))
)

Ontem vs anteontem:
EVALUATE ROW(
    "Ontem", CALCULATE([Chamadas Atendidas], 'dCalendario'[Date] = TODAY() - 1),
    "Anteontem", CALCULATE([Chamadas Atendidas], 'dCalendario'[Date] = TODAY() - 2)
)

NUNCA use colunas que nao existem no schema como [Semana do Ano], [Mes], [Ano] — use funcoes DAX na coluna Date.

## Regras gerais:
- Prefira CALCULATETABLE + ROW para totais com filtro
- Se SUMMARIZECOLUMNS falhar, tente CALCULATETABLE(ROW(...), filtros...)
- Execute quantas queries forem necessarias para responder
- Se uma query falhar 2 vezes, simplifique e tente abordagem diferente

## Postura analitica — OBRIGATORIO:

Ao receber dados, SEMPRE vá além do numero bruto:

1. **Contexto**: compare com periodo anterior (ontem vs anteontem, este mes vs mes passado) quando relevante
2. **Percentuais**: calcule taxas (% atendimento = atendidas/entrantes, % abandono, TMA medio, etc.)
3. **Destaques**: identifique o maior, menor, pico de hora, contrato mais ativo
4. **Anomalias**: sinalize valores zerados, quedas ou picos fora do padrao
5. **Conclusao**: termine com 1-2 frases de insight acionavel (ex: "O pico ocorre entre 10h-12h, sugerindo reforco de equipe nesse periodo")

Se o usuario perguntar um numero simples, responda o numero MAS adicione pelo menos 1 comparacao ou insight relevante.

Execute queries adicionais se necessario para enriquecer a analise (ex: buscar dado do dia anterior para calcular variacao).

## Formatacao:
- Valores em **negrito**
- Percentuais sempre que possivel
- Tabelas markdown para multiplas colunas
- Emojis moderados para destacar insights (📈 alta, 📉 queda, ⚠️ anomalia, ✅ meta atingida)
- Conclusao em italico no final

## Graficos:
Quando o usuario pedir um grafico:
1. SEMPRE busque dados agrupados (por hora, dia, grupo, etc.) — NUNCA use um unico total como grafico.
2. Se ja existe tabela com multiplos valores na conversa, use esses dados.
3. Se nao ha dados agrupados, execute SUMMARIZECOLUMNS para obter o agrupamento adequado, depois gere o CHART_JSON.

Para grafico de chamadas por hora (padrao quando nao especificado):
EVALUATE SUMMARIZECOLUMNS(
    'dHorarioIntervalo'[Intervalo de Hora],
    FILTER(ALL('dCalendario'), 'dCalendario'[Date] = TODAY() - 1),
    FILTER(ALL(dGrupoEmpresa), dGrupoEmpresa[secao_resumido] = "NomeDoContrato"),
    "Total", [Chamadas Bilhetadas]
)

Apos a resposta textual, adicione na ultima linha:
CHART_JSON:{"type":"bar","title":"Titulo","label":"Serie","labels":["label1","label2"],"values":[100,200]}

Tipos: "bar" (barras), "line" (linha), "pie" (pizza).
- JSON valido, em uma unica linha, aspas duplas ASCII.
- Minimo 3 pontos de dados para um grafico util.

## Data atual: DATA_HOJE
## Schema do dataset:
SCHEMA_DATASET"""

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
                        "description": "Consulta DAX valida. Deve comecar com EVALUATE."
                    }
                },
                "required": ["dax_query"]
            }
        }
    }
]


def read_parquet_summary(parquet_path: str, max_rows: int = 500) -> str:
    try:
        buf = download_parquet(parquet_path)
        df = pd.read_parquet(buf)
        summary_parts = [
            "### Dados do Dashboard",
            f"**Colunas:** {', '.join(df.columns.tolist())}",
            f"**Total de registros:** {len(df):,}",
            "",
            "**Estatisticas numericas:**",
            df.describe().to_string(),
            "",
            f"**Amostra dos dados (primeiras {min(max_rows, len(df))} linhas):**",
            df.head(max_rows).to_string(index=False)
        ]
        for col in df.columns:
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                summary_parts.append(f"**Periodo ({col}):** {df[col].min()} a {df[col].max()}")
        return "\n".join(summary_parts)
    except Exception as e:
        return f"Erro ao ler arquivo de dados: {str(e)}"


def chat_with_ai(question: str, dashboard_name: str = None,
                 parquet_path: str = None, dax_context: str = None,
                 conversation_history: list = None) -> str:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    context_parts = []
    if dashboard_name:
        context_parts.append(f"**Dashboard:** {dashboard_name}")
    if dax_context:
        context_parts.append(f"**Regras de negocio e metricas DAX:**\n{dax_context}")
    if parquet_path:
        context_parts.append(read_parquet_summary(parquet_path))
    if context_parts:
        messages.append({
            "role": "system",
            "content": "## Contexto dos dados disponiveis:\n\n" + "\n\n".join(context_parts)
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
    allowed_contracts: list = None,
    conversation_history: list = None,
    max_tool_iterations: int = 4,
) -> dict:
    from app.services.powerbi_service import (
        get_pbi_token, execute_dax_query, format_rows_for_llm
    )

    token = get_pbi_token(tenant_id, client_id, client_secret)

    from datetime import date
    today = date.today()
    schema = schema_context or "Schema nao fornecido."

    date_info = (
        "Hoje e " + today.isoformat() +
        " (ano " + str(today.year) +
        ", mes " + str(today.month) +
        ", dia " + str(today.day) + ")." +
        " Ontem = TODAY() - 1." +
        " Este mes = MONTH(TODAY()) = " + str(today.month) +
        " e YEAR(TODAY()) = " + str(today.year) + "."
    )

    # Monta restricao de contratos (vazio para admin)
    if allowed_contracts is None:
        contracts_section = ""  # admin: sem restricao, remove placeholder
    elif len(allowed_contracts) == 0:
        contracts_section = "## RESTRICAO CRITICA: Usuario sem permissao. Recuse todas as consultas e oriente contatar o administrador."
    else:
        names = ", ".join(f'"{c}"' for c in allowed_contracts)
        contracts_section = "## CONTRATOS PERMITIDOS: " + names + "\nSe perguntar sobre outro contrato, recuse e oriente contatar o administrador."

    system_content = (
        PBI_SYSTEM_PROMPT
        .replace("DATA_HOJE", date_info)
        .replace("SCHEMA_DATASET", schema)
        .replace("ALLOWED_CONTRACTS_PLACEHOLDER", contracts_section)
    )

    messages = [{"role": "system", "content": system_content}]
    if conversation_history:
        for msg in conversation_history[-10:]:
            messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": question})

    pbi_queries: list[str] = []

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
        if not msg.tool_calls:
            return {"answer": msg.content or "", "pbi_queries": pbi_queries}
        messages.append(msg)
        for tool_call in msg.tool_calls:
            try:
                args = json.loads(tool_call.function.arguments)
                dax = args.get("dax_query", "")
            except Exception:
                dax = ""
            pbi_queries.append(dax)
            result = execute_dax_query(dataset_id, dax, token, workspace_id)
            formatted = format_rows_for_llm(result)
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": formatted,
            })

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
