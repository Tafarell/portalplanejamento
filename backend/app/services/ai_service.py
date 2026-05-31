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

PBI_SYSTEM_PROMPT = """Você é um assistente de BI conectado ao Power BI em tempo real.

## REGRAS CRITICAS:

1. NUNCA invente números. Só apresente valores que vieram diretamente da query.
0. Você é um AGENTE DE DADOS. SEMPRE consulte os dados reais via query antes de responder. Não substitua dados por teoria.
   EXCEÇÃO: Quando pedido DIMENSIONAMENTO ou ERLANG C, busque os dados reais (volume, TMA) e DEPOIS calcule:
   
   CÁLCULO DE ERLANG C (dimensionamento de agentes):
   1. Buscar via query: Chamadas por hora (λ) e TMA em segundos
   2. Intensidade de tráfego: A = λ × (TMA/3600)
   3. Para NS alvo (ex: 80% em 20s), calcule N agentes mínimos via Erlang C iterativo:
      - C(N,A) = (A^N/N!) × N/(N-A) ÷ [Σ(A^k/k!, k=0..N-1) + (A^N/N!) × N/(N-A)]
      - NS = 1 - C(N,A) × e^(-(N-A)×(tempo_alvo/TMA))
   4. Apresente: agentes necessários, fator de ocupação (A/N), e NS estimado
   5. Sempre baseie λ e TMA nos dados reais consultados
   NOTA: Ligações entrantes = Recebidas = [Chamadas Entrantes] (atendidas + abandonadas na fila humana)
         Recebidas na URA = total que entrou no sistema eletrônico (maior que Entrantes)
1b. Use SOMENTE os nomes de medidas EXATOS do schema abaixo. NUNCA adivinhe ou abrevie nomes de medidas. Se não encontrar a medida no schema, pergunte ao usuário o nome correto.
2. Tabelas com acento SEMPRE entre aspas simples: 'dCalendário'[Date]
3. Para filtros com MONTH/WEEKNUM, use FILTER(ALL(...)): FILTER(ALL('dCalendário'), MONTH('dCalendário'[Date]) = 4)
4. SUMMARIZECOLUMNS: filtros de função dentro de FILTER(), nunca diretamente
5. Se query retornar 0 ou vazio para "hoje": tente automaticamente o MÊS ATUAL antes de desistir
6. Se mês também retornar 0: tente o ANO atual
7. Sempre informe qual período os dados se referem na resposta
8. Formate números no padrão brasileiro: 1.234.567 (ponto como separador de milhar)
9. Quando query falhar, mude COMPLETAMENTE a estratégia — não repita variações parecidas

## CONTRATOS DISPONÍVEIS (dGrupoEmpresa[secao_resumido]):

Use EXATAMENTE estes nomes ao filtrar:
"DMAE", "CEUMA", "PMSP", "SPPREV", "TERRACAP", "PMSJP", "DEFENSORIA",
"MINISTÉRIO DA SAÚDE", "156 - PMBVSERV", "TELEMATRÍCULA", "CDHU",
"BV ENERGIA - RR", "MEC - SP", "JC GONTIJO", "SEFAZ", "ANTT",
"MDHC", "LIGUE 180", "BAHIA GAS", "EMBASA", "MEC", "ÂMBAR (AM)"

Aliases aceitos:
- Disque 100 / MDHC / Ministerio Direitos Humanos → "MDHC"
- Amazonas Energia / Ambar / Âmbar → "ÂMBAR (AM)"
- Ligue 180 / SPM / 180 → "LIGUE 180"
- Prefeitura SP / PMSP → "PMSP"
- Defensoria → "DEFENSORIA"
- SEFAZ / Fazenda SP → "SEFAZ"
- MEC DF → "MEC" | MEC SP → "MEC - SP"
- Embasa → "EMBASA"
- Ministerio da Saude → "MINISTÉRIO DA SAÚDE"
- Roraima / BV Energia → "BV ENERGIA - RR"

Se o usuario mencionar contrato: filtre por dGrupoEmpresa[secao_resumido] = "NomeExato".
Se não mencionar: NÃO filtre — retorne todos os contratos.

## MEDIDAS CONHECIDAS (apenas se confirmadas no schema do dataset atual):
Contact Center: [Chamadas Bilhetadas], [Chamadas Atendidas], [Chamadas Abandonadas], [Chamadas Entrantes], [Recebidas na URA], [Retida na URA]
Tempo: [Tempo Médio Atendidas], [Tempo Médio Espera], [Tempo Médio de Pausa]
Performance: [Nível de Serviço], [Nível de Abandono], [Absenteísmo], [Score]
RH: [Total de Colaboradores Desligados], [Total de Colaboradores Contratados], [Taxa de Desligamento]

IMPORTANTE: Use SOMENTE medidas presentes no schema do dataset atual (seção abaixo).
Datasets diferentes têm medidas diferentes. Não use medidas de outro dataset.

## EXEMPLOS DAX:

IMPORTANTE: Medidas de volume SEMPRE precisam de filtro de data. Sem filtro de data, retornam BLANK.

Ontem (sempre use este padrão para "total de ontem"):
EVALUATE CALCULATETABLE(
    ROW("Total", [Chamadas Bilhetadas]),
    'dCalendário'[Date] = TODAY() - 1
)

Ontem com contrato:
EVALUATE CALCULATETABLE(
    ROW("Total", [Chamadas Atendidas]),
    'dCalendário'[Date] = TODAY() - 1,
    dGrupoEmpresa[secao_resumido] = "LIGUE 180"
)

Com filtro de mês:
EVALUATE CALCULATETABLE(
    ROW("Total", [Chamadas Atendidas]),
    FILTER(ALL('dCalendário'), MONTH('dCalendário'[Date]) = 4 && YEAR('dCalendário'[Date]) = 2026),
    dGrupoEmpresa[secao_resumido] = "LIGUE 180"
)

Por hora:
EVALUATE SUMMARIZECOLUMNS(
    'dHorárioIntervalo'[Intervalo de Hora],
    FILTER(ALL('dCalendário'), 'dCalendário'[Date] = TODAY() - 1),
    FILTER(ALL(dGrupoEmpresa), dGrupoEmpresa[secao_resumido] = "LIGUE 180"),
    "Total", [Chamadas Atendidas]
)

Por mês (use MONTH na coluna Date, NAO colunas Mês/Ano que podem nao existir):
EVALUATE SUMMARIZECOLUMNS(
    MONTH('dCalendário'[Date]),
    FILTER(ALL('dCalendário'), YEAR('dCalendário'[Date]) = 2026),
    FILTER(ALL(dGrupoEmpresa), dGrupoEmpresa[secao_resumido] = "LIGUE 180"),
    "Total", [Chamadas Bilhetadas]
)

## POSTURA ANALÍTICA E FORMATO:

Seja CONCISO. Máximo 5-6 linhas de análise. Prefira bullet points curtos.

Formato obrigatório da resposta:
1. Dados do período (1-2 linhas)
2. Comparação com período anterior (1 linha)
3. ⚠️ ALERTA se anomalia crítica (abandono >15%, TMA >20% acima da média, queda >30% no volume)
4. 💡 Insight acionável (1 linha)
5. **Sugestões de análise:** (sempre terminar com 2-3 perguntas curtas que o usuario pode fazer)

Alertas críticos — use sempre ⚠️ em destaque:
- Abandono >15%: ⚠️ CRÍTICO: Abandono em X% — revisar escala urgente
- TMA >20% da média histórica: ⚠️ TMA elevado — possível gargalo no atendimento
- Volume -30% vs anterior: ⚠️ Queda significativa — verificar disponibilidade do sistema

TMA e TME: sempre em formato hh:mm:ss (ex: 00:05:31, não "331 segundos")
Números: sempre formato BR com ponto (1.234.567)
Percentuais: sempre com vírgula (10,53%)

## TABELAS E GRÁFICOS:

Quando os dados tiverem MÚLTIPLAS LINHAS, SEMPRE formate como tabela markdown.

REGRA DE PIVOT: Quando dados tiverem MES + CONTRATO + VALOR, pivote:
- Contratos nas LINHAS (vertical)
- Meses nas COLUNAS (horizontal)
- Adicione coluna Total no final

Exemplo correto:
| Contrato | Jan | Fev | Mar | Total |
|----------|-----|-----|-----|-------|
| PMSP | 84 | 74 | 56 | 214 |
| MDHC | 12 | 23 | 13 | 48 |
| **Total** | **96** | **97** | **69** | **262** |

Quando pedido grafico ou dados forem temporais, adicione CHART_JSON na ultima linha:
CHART_JSON:{"type":"bar","title":"Titulo","label":"Serie","labels":["l1","l2"],"values":[100,200]}

Tipos de gráfico:
- "bar": comparações entre categorias
- "line": tendências temporais (por mês, semana)
- "pie": distribuição proporcional (% por contrato)

## DATA ATUAL: DATA_HOJE

ALLOWED_CONTRACTS_PLACEHOLDER

## SCHEMA DO DATASET:
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
    # Extrai nomes de medidas do schema para injetar de forma compacta
    raw_schema = schema_context or ""
    import re
    # Extrai todos os nomes de medidas (linhas com [Nome])
    measure_names = re.findall(r'\[([^\]]+)\]', raw_schema)
    # Remove duplicatas mantendo ordem
    seen = set()
    unique_measures = [m for m in measure_names if not (m in seen or seen.add(m))]
    
    if unique_measures:
        measures_list = ", ".join(f"[{m}]" for m in unique_measures)  # todas as medidas
        schema = f"MEDIDAS EXATAS DISPONÍVEIS (use SOMENTE estes nomes):\n{measures_list}\n\nSchema resumido:\n{raw_schema[:1500]}"
    else:
        schema = raw_schema[:3000] + ("..." if len(raw_schema) > 3000 else "")

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
            # Garante content nunca null (OpenRouter/Azure rejeita null)
            messages.append({"role": msg["role"], "content": msg.get("content") or ""})
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
            print(f"[AI DEBUG] Resposta final: {repr((msg.content or '')[:200])}")
            return {"answer": msg.content or "", "pbi_queries": pbi_queries}
        # Converte para dict garantindo content nunca null (OpenRouter/Azure rejeita null)
        msg_dict = {
            "role": "assistant",
            "content": msg.content or "",
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.function.name, "arguments": tc.function.arguments}
                }
                for tc in msg.tool_calls
            ]
        }
        messages.append(msg_dict)
        for tool_call in msg.tool_calls:
            try:
                args = json.loads(tool_call.function.arguments)
                dax = args.get("dax_query", "")
            except Exception:
                dax = ""
            pbi_queries.append(dax)
            result = execute_dax_query(dataset_id, dax, token, workspace_id)
            formatted = format_rows_for_llm(result)
            print(f"[AI DEBUG] Tool result (primeiros 200 chars): {repr(formatted[:200])}")
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": formatted or "",
            })

    # Fallback: força resposta textual sem tools
    messages.append({
        "role": "user",
        "content": "Com base nos dados acima, responda a pergunta original de forma completa e analitica."
    })
    response = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=messages,
        tool_choice="none",  # Proibe tool calls no fallback
        temperature=0.1,
        max_tokens=4000,
    )
    answer = response.choices[0].message.content or "Não foi possível gerar uma resposta."
    return {
        "answer": answer,
        "pbi_queries": pbi_queries,
    }


def chat_with_multi_powerbi(
    question: str,
    connections: list,           # [{"id": 1, "name": "...", "description": "...", ...}, ...]
    allowed_contracts: list = None,
    conversation_history: list = None,
    max_tool_iterations: int = 6,
) -> dict:
    """
    Chat com múltiplas conexões Power BI.
    Cria um tool por conexão para que a IA escolha a fonte certa.
    """
    from app.services.powerbi_service import (
        get_pbi_token, execute_dax_query, format_rows_for_llm
    )

    from datetime import date
    today = date.today()

    # Obtém tokens para todas as conexões
    conn_map = {}
    tools = []
    schema_parts = []

    for conn in connections:
        try:
            token = get_pbi_token(conn["tenant_id"], conn["client_id"], conn["client_secret"])
            conn_map[str(conn["id"])] = {"token": token, "conn": conn}

            tool_name = f"query_pbi_{conn['id']}"
            conn_label = conn.get("name", f"Conexão {conn['id']}")
            conn_desc = conn.get("description") or conn_label

            tools.append({
                "type": "function",
                "function": {
                    "name": tool_name,
                    "description": f"Executa DAX no dataset '{conn_label}' ({conn_desc}). Use para perguntas sobre {conn_desc}.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "dax_query": {
                                "type": "string",
                                "description": "Consulta DAX válida começando com EVALUATE."
                            }
                        },
                        "required": ["dax_query"]
                    }
                }
            })

            schema = "\n\n".join(filter(None, [
                conn.get("schema_context"),
                conn.get("measures_context"),
            ]))
            if schema:
                schema_parts.append(f"## Dataset: {conn_label}\n{schema}")
        except Exception as e:
            schema_parts.append(f"## Dataset: {conn.get('name', conn['id'])} — ERRO ao conectar: {e}")

    combined_schema = "\n\n---\n\n".join(schema_parts) if schema_parts else "Schemas não disponíveis."

    # Monta system prompt
    if allowed_contracts is None:
        contracts_section = ""
    elif len(allowed_contracts) == 0:
        contracts_section = "## RESTRICAO: sem permissao para nenhum contrato."
    else:
        names = ", ".join(f'"{c}"' for c in allowed_contracts)
        contracts_section = f"## CONTRATOS PERMITIDOS: {names}"

    date_info = (
        "Hoje e " + today.isoformat() +
        " (ano " + str(today.year) + ", mes " + str(today.month) + ", dia " + str(today.day) + ")."
        " Ontem = TODAY() - 1."
    )

    system_content = (
        PBI_SYSTEM_PROMPT
        .replace("DATA_HOJE", date_info)
        .replace("SCHEMA_DATASET", combined_schema)
        .replace("ALLOWED_CONTRACTS_PLACEHOLDER", contracts_section)
    )

    messages = [{"role": "system", "content": system_content}]
    if conversation_history:
        for msg in conversation_history[-10:]:
            messages.append({"role": msg["role"], "content": msg.get("content") or ""})
    messages.append({"role": "user", "content": question})

    pbi_queries: list[str] = []

    # Se nao ha tools disponiveis, responde direto
    if not tools:
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=messages,
            temperature=0.2,
            max_tokens=4000,
        )
        return {"answer": response.choices[0].message.content or "Nenhuma conexao disponivel.", "pbi_queries": []}

    for _ in range(max_tool_iterations):
        kwargs = {"model": settings.OPENAI_MODEL, "messages": messages, "temperature": 0.1, "max_tokens": 4000}
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"
        response = client.chat.completions.create(**kwargs)
        msg = response.choices[0].message
        if not msg.tool_calls:
            print(f"[AI DEBUG] Resposta final: {repr((msg.content or '')[:200])}")
            return {"answer": msg.content or "", "pbi_queries": pbi_queries}

        msg_dict = {
            "role": "assistant",
            "content": msg.content or "",
            "tool_calls": [
                {"id": tc.id, "type": "function",
                 "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                for tc in msg.tool_calls
            ]
        }
        messages.append(msg_dict)

        for tool_call in msg.tool_calls:
            fn_name = tool_call.function.name  # e.g. "query_pbi_1"
            try:
                args = json.loads(tool_call.function.arguments)
                dax = args.get("dax_query", "")
            except Exception:
                dax = ""

            pbi_queries.append(f"[{fn_name}] {dax}")

            # Identifica a conexão pelo nome do tool
            conn_id = fn_name.replace("query_pbi_", "")
            conn_info = conn_map.get(conn_id)
            if conn_info:
                result = execute_dax_query(
                    conn_info["conn"]["dataset_id"], dax,
                    conn_info["token"], conn_info["conn"].get("workspace_id")
                )
                formatted = format_rows_for_llm(result)
            else:
                formatted = f"❌ Conexão '{conn_id}' não encontrada."

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": formatted or "",
            })

    # Fallback sem tools
    messages.append({"role": "user", "content": "Com base nos dados acima, responda a pergunta original de forma completa e analitica."})
    response = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=messages,
        temperature=0.2,
        max_tokens=4000,
    )
    return {
        "answer": response.choices[0].message.content or "Os dados foram consultados. Faça uma pergunta mais específica.",
        "pbi_queries": pbi_queries,
    }
