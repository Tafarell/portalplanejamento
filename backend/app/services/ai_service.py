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
- Correto: 'dCalendário'[Date]
- Correto: FILTER(ALL('dCalendário'), 'dCalendário'[Date] = ...)
- Correto: 'dHorarioIntervalo'[Intervalo de Hora]
- ERRADO: dCalendário[Date] sem aspas simples causa erro de sintaxe

## ALIASES E NOMES DE CONTRATOS:

Use sempre o nome exato do campo secao_resumido ao filtrar. Aliases aceitos:
- "MDHC" ou "Disque 100" ou "Ministerio dos Direitos Humanos" -> filtrar por dGrupoEmpresa[secao_resumido] = "MDHC"
- "AMBAR" ou "Amazonas Energia" ou "Ambar AM" -> filtrar por dGrupoEmpresa[secao_resumido] = "AMBAR (AM)"
- "Ligue 180" ou "SPM" ou "180" -> filtrar por dGrupoEmpresa[secao_resumido] = "LIGUE 180"
- "PMSP" ou "Prefeitura SP" ou "Prefeitura de Sao Paulo" -> filtrar por dGrupoEmpresa[secao_resumido] = "PMSP"
- "Defensoria" -> filtrar por dGrupoEmpresa[secao_resumido] = "DEFENSORIA"
- "SEFAZ" ou "Fazenda" -> filtrar por dGrupoEmpresa[secao_resumido] = "SEFAZ"
- "MEC" -> filtrar por dGrupoEmpresa[secao_resumido] = "MEC" ou "MEC - SP"
- "Embasa" -> filtrar por dGrupoEmpresa[secao_resumido] = "EMBASA"
- "CDHU" -> filtrar por dGrupoEmpresa[secao_resumido] = "CDHU"

## REGRA DE FILTRO POR CONTRATO — OBRIGATÓRIO:

A dimensão dGrupoEmpresa identifica o contrato/servico. Coluna-chave:
- secao_resumido -> nome do contrato

- Se o usuario mencionar um contrato/servico especifico, filtre por dGrupoEmpresa[secao_resumido] = "NomeExato".
- Se o usuario NAO mencionar contrato especifico, NAO adicione filtro de contrato — retorne dados de todos os contratos.
- Administrador pode ver todos os contratos sem restricao.

## DICIONARIO DE MEDIDAS — CONTEXTO DE NEGOCIO:

Tabelas fato do modelo:
- fBaseGeral: dados brutos de bilhetagem (operadora telefonica) e URA. Base para volumetria de entrada.
- fBaseDac: chamadas que chegaram na fila humana (DAC). Base para TMA, TME, atendidas, abandonadas.
- fBEventosAgentes: pausas e eventos dos agentes. Base para TMP (Tempo Medio de Pausa).
- fBGeralAbsenteismo: carga horaria agendada vs permanencia logada. Base para absenteismo.

Medidas principais e suas definicoes:
- [Chamadas Bilhetadas]: demanda bruta recebida pela operadora antes de qualquer roteamento interno
- [Recebidas na URA]: chamadas que efetivamente entraram no atendimento eletronico (URA)
- [Retida na URA]: demanda resolvida 100% eletronicamente sem chegar ao humano
- [Chamadas Entrantes]: = Atendidas + Abandonadas (chegaram na fila humana)
- [Chamadas Atendidas]: atendidas com sucesso pelo operador humano
- [Chamadas Abandonadas]: cliente desistiu enquanto aguardava na fila humana
- [Chamadas Desistente/Bloqueadas]: desligou logo apos a URA antes de entrar na fila
- [Tempo Médio Atendidas] ou TMA: AHT em segundos. Principal componente do custo.
- [Tempo Médio Espera] ou TME: ASA em segundos. Tempo medio do cliente na fila humana.
- [Tempo Médio de Pausa] ou TMP: tempo medio de pausa dos agentes
- [Absenteísmo]: 1 - (permanencia / carga horaria). Alta = equipe ausente.
- [Nível de Serviço]: % chamadas atendidas dentro do tempo limite (meta SLA)
- [Nível de Abandono]: % chamadas abandonadas apos o tempo limite (meta IAB)
- [Rechamadas]: clientes que ligaram mais de 1x no mesmo dia (baixo FCR - First Call Resolution)
- [% Rechamadas]: rechamadas / bilhetadas. Mede inversamente a resolutividade.
- [Score]: pontuacao 0-1000 combinando NS, Abandono, Absenteismo e TMP (pesos 25% cada)

Logica de diagnostico em cascata (use quando perguntar sobre causa de problemas):
1. Abandono DAC subiu? -> Verificar TME alto
2. TME subiu? -> Verificar absenteismo ou pico de trafego
3. Escala estava cheia? -> Verificar TMA. TMA longo reduz vazao e infla TME.
4. TMA e escala normais? -> Verificar Chamadas Bilhetadas para pico atipico

Alertas criticos (desvio > 15% da media historica = sinal vermelho):
- Abandono DAC > 15% da media historica = calamidade operacional
- TMA > 15% = custo elevado, revisar script
- Absenteismo > meta = falta de escala
- Rechamadas altas = problema de resolutividade (FCR baixo)

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
    'dCalendário'[Date] = TODAY() - 1,
    dGrupoEmpresa[secao_resumido] = "NomeDoContrato"
)

Total filtrado por mes atual + contrato:
EVALUATE CALCULATETABLE(
    ROW("Total", [Chamadas Atendidas]),
    MONTH('dCalendário'[Date]) = MONTH(TODAY()),
    YEAR('dCalendário'[Date]) = YEAR(TODAY()),
    dGrupoEmpresa[secao_resumido] = "NomeDoContrato"
)

Tabela agrupada com filtros de data e contrato:
EVALUATE SUMMARIZECOLUMNS(
    'dHorarioIntervalo'[Intervalo de Hora],
    FILTER(ALL('dCalendário'), 'dCalendário'[Date] = TODAY() - 1),
    FILTER(ALL(dGrupoEmpresa), dGrupoEmpresa[secao_resumido] = "NomeDoContrato"),
    "Total", [Chamadas Atendidas]
)

NUNCA use sintaxe invalida:
- SUMMARIZECOLUMNS com igualdade direta: Tabela[Coluna] = valor ERRADO
- Tabelas com acento sem aspas simples: dCalendário sem aspas ERRADO

## Comparacoes de periodo — sintaxe correta:

IMPORTANTE: Para filtros com funcoes (WEEKNUM, MONTH, etc.), SEMPRE use FILTER(ALL(...)).
Filtros simples de igualdade (Date = valor) podem ir direto no CALCULATETABLE.

Esta semana vs semana anterior:
EVALUATE ROW(
    "Esta Semana", CALCULATE([Chamadas Atendidas], FILTER(ALL('dCalendário'), WEEKNUM('dCalendário'[Date]) = WEEKNUM(TODAY()) && YEAR('dCalendário'[Date]) = YEAR(TODAY()))),
    "Semana Anterior", CALCULATE([Chamadas Atendidas], FILTER(ALL('dCalendário'), WEEKNUM('dCalendário'[Date]) = WEEKNUM(TODAY()) - 1 && YEAR('dCalendário'[Date]) = YEAR(TODAY())))
)

Este mes vs mes anterior:
EVALUATE ROW(
    "Este Mes", CALCULATE([Chamadas Atendidas], FILTER(ALL('dCalendário'), MONTH('dCalendário'[Date]) = MONTH(TODAY()) && YEAR('dCalendário'[Date]) = YEAR(TODAY()))),
    "Mes Anterior", CALCULATE([Chamadas Atendidas], FILTER(ALL('dCalendário'), MONTH('dCalendário'[Date]) = MONTH(TODAY()) - 1 && YEAR('dCalendário'[Date]) = YEAR(TODAY())))
)

Ontem vs anteontem:
EVALUATE ROW(
    "Ontem", CALCULATE([Chamadas Atendidas], FILTER(ALL('dCalendário'), 'dCalendário'[Date] = TODAY() - 1)),
    "Anteontem", CALCULATE([Chamadas Atendidas], FILTER(ALL('dCalendário'), 'dCalendário'[Date] = TODAY() - 2))
)

NUNCA use colunas que nao existem no schema como [Semana do Ano], [Mes], [Ano].
NUNCA use expressoes booleanas direto no CALCULATE sem FILTER — use FILTER(ALL(Tabela), condicao).

## Regras gerais:
- Prefira CALCULATETABLE + ROW para totais com filtro
- LIMITE de medidas por SUMMARIZECOLUMNS: maximo 4 medidas por query. Se precisar de mais, faca multiplas queries.
- Se SUMMARIZECOLUMNS falhar, tente CALCULATETABLE(ROW(...), filtros...) com 1-2 medidas
- Execute quantas queries forem necessarias para responder
- Se uma query falhar 2 vezes, simplifique drasticamente — use apenas 1 medida por vez
- Queries com muitas medidas ao mesmo tempo causam timeout — prefira queries menores e combine os resultados

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
CHART_JSON suporta UMA unica serie de dados (labels + values). Para gerar:
1. Escolha UMA metrica principal (ex: Chamadas Atendidas, Chamadas Bilhetadas)
2. Escolha UMA dimensao de agrupamento (ex: hora, dia, contrato)
3. Execute query SIMPLES com apenas essa metrica e dimensao
4. Gere o CHART_JSON na ultima linha da resposta

Query simples para grafico por hora:
EVALUATE SUMMARIZECOLUMNS(
    'dHorarioIntervalo'[Intervalo de Hora],
    FILTER(ALL('dCalendário'), 'dCalendário'[Date] = TODAY() - 1),
    FILTER(ALL(dGrupoEmpresa), dGrupoEmpresa[secao_resumido] = "NomeDoContrato"),
    "Total", [Chamadas Atendidas]
)

Query simples para grafico por dia:
EVALUATE SUMMARIZECOLUMNS(
    'dCalendário'[Date],
    FILTER(ALL('dCalendário'), MONTH('dCalendário'[Date]) = MONTH(TODAY()) && YEAR('dCalendário'[Date]) = YEAR(TODAY())),
    FILTER(ALL(dGrupoEmpresa), dGrupoEmpresa[secao_resumido] = "NomeDoContrato"),
    "Total", [Chamadas Atendidas]
)

Formato obrigatorio na ultima linha:
CHART_JSON:{"type":"bar","title":"Titulo","label":"Metrica","labels":["label1","label2"],"values":[100,200]}

Tipos: "bar" (barras), "line" (linha para tendencia temporal), "pie" (pizza para proporcoes).
- JSON valido em UMA unica linha
- NUNCA tente colocar multiplas series no mesmo grafico

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
