"""
Serviço de integração com a API REST do Power BI.

Fluxo:
  1. get_pbi_token()      → obtém access token via Service Principal
  2. get_dataset_schema() → busca tabelas/colunas/medidas para injetar no prompt
  3. execute_dax_query()  → executa DAX e retorna linhas como lista de dicts
"""

import httpx
import json
from typing import Optional

PBI_TOKEN_URL  = "https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
# Suporta dataset global e workspace-scoped (Fabric / OneLake)
PBI_TABLES_URL = "https://api.powerbi.com/v1.0/myorg/groups/{workspace_id}/datasets/{dataset_id}/tables"
PBI_TABLES_URL_GLOBAL = "https://api.powerbi.com/v1.0/myorg/datasets/{dataset_id}/tables"
PBI_QUERY_URL  = "https://api.powerbi.com/v1.0/myorg/groups/{workspace_id}/datasets/{dataset_id}/executeQueries"
PBI_QUERY_URL_GLOBAL = "https://api.powerbi.com/v1.0/myorg/datasets/{dataset_id}/executeQueries"

_TIMEOUT = 45  # segundos


def get_pbi_token(tenant_id: str, client_id: str, client_secret: str) -> str:
    """Obtém um Bearer token via client_credentials (Service Principal)."""
    url = PBI_TOKEN_URL.format(tenant_id=tenant_id)
    with httpx.Client(timeout=_TIMEOUT) as client:
        resp = client.post(url, data={
            "grant_type":    "client_credentials",
            "client_id":     client_id,
            "client_secret": client_secret,
            "scope":         "https://analysis.windows.net/powerbi/api/.default",
        })
        resp.raise_for_status()
        data = resp.json()
        if "access_token" not in data:
            raise ValueError(f"Token não retornado: {data.get('error_description', data)}")
        return data["access_token"]


def test_connection(dataset_id: str, token: str, workspace_id: Optional[str] = None) -> dict:
    """
    Testa a conexão executando uma query DAX simples.
    Retorna { "ok": True/False, "error": str|None }
    """
    result = execute_dax_query(dataset_id, "EVALUATE ROW(\"Status\", \"Connected\")", token, workspace_id)
    if result.get("error"):
        return {"ok": False, "error": result["error"]}
    return {"ok": True, "error": None}


def execute_dax_query(dataset_id: str, dax_query: str, token: str, workspace_id: Optional[str] = None) -> dict:
    """
    Executa uma query DAX e retorna:
      { "rows": [...], "count": int, "dax_query": str, "error": str|None }
    """
    if workspace_id:
        url = PBI_QUERY_URL.format(workspace_id=workspace_id, dataset_id=dataset_id)
    else:
        url = PBI_QUERY_URL_GLOBAL.format(dataset_id=dataset_id)
    payload = {
        "queries": [{"query": dax_query}],
        "serializerSettings": {"includeNulls": True},
    }
    with httpx.Client(timeout=_TIMEOUT) as client:
        resp = client.post(
            url,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=payload,
        )

    try:
        data = resp.json() or {}
    except Exception:
        data = {}

    # Erros de nível HTTP
    if resp.status_code >= 400:
        err = data.get("error", {}) if isinstance(data, dict) else {}
        return {
            "rows": [],
            "count": 0,
            "dax_query": dax_query,
            "error": err.get("message") or resp.text,
        }

    if not isinstance(data, dict):
        return {"rows": [], "count": 0, "dax_query": dax_query, "error": f"Resposta inesperada: {resp.text[:200]}"}

    # Erros de nível DAX
    results = data.get("results", [])
    if not results:
        return {"rows": [], "count": 0, "dax_query": dax_query, "error": "Sem resultados"}

    first = results[0]
    if "error" in first:
        return {"rows": [], "count": 0, "dax_query": dax_query, "error": first["error"].get("message", "DAX error")}

    tables = first.get("tables", [])
    rows = tables[0].get("rows", []) if tables else []

    return {
        "rows": rows,
        "count": len(rows),
        "dax_query": dax_query,
        "error": None,
    }


def _clean_key(k: str) -> str:
    """Remove prefixo de tabela e colchetes dos nomes de coluna retornados pela API."""
    if "[" in k:
        return k.split("[")[-1].rstrip("]")
    return k


def explore_tables_columns(
    dataset_id: str,
    token: str,
    table_names: list[str],
    workspace_id: Optional[str] = None,
) -> dict:
    """
    Para cada tabela informada, executa EVALUATE TOPN(1, 'Tabela') e extrai
    os nomes das colunas dos cabeçalhos da resposta.

    Retorna:
      {
        "schema_text": str,          # pronto para colar em schema_context
        "tables_found": list[str],   # tabelas consultadas com sucesso
        "errors": dict[str, str],    # tabelas que falharam → mensagem de erro
      }
    """
    tables_found: list[str] = []
    errors: dict[str, str] = {}
    lines: list[str] = []

    for raw_name in table_names:
        tname = raw_name.strip()
        if not tname:
            continue

        # Usa aspas simples para nomes com caracteres especiais (ex: dContratados&Desligados)
        dax = f"EVALUATE TOPN(1, '{tname}')"
        result = execute_dax_query(dataset_id, dax, token, workspace_id)

        lines.append(f"Tabela: {tname}")

        if result.get("error"):
            errors[tname] = result["error"]
            lines.append(f"  ⚠️ Erro: {result['error']}")
        else:
            rows = result.get("rows", [])
            if rows:
                cols = [_clean_key(k) for k in rows[0].keys()]
                lines.append(f"  Colunas: {', '.join(cols)}")
                tables_found.append(tname)
            else:
                lines.append("  Colunas: (tabela vazia)")
                tables_found.append(tname)

        lines.append("")

    return {
        "schema_text": "\n".join(lines).strip(),
        "tables_found": tables_found,
        "errors": errors,
    }


def _get_tables_list(dataset_id: str, token: str, workspace_id: Optional[str] = None) -> list[str]:
    """Obtém a lista de tabelas via REST API padrão (sem permissão de admin)."""
    if workspace_id:
        url = f"https://api.powerbi.com/v1.0/myorg/groups/{workspace_id}/datasets/{dataset_id}/tables"
    else:
        url = f"https://api.powerbi.com/v1.0/myorg/datasets/{dataset_id}/tables"
    with httpx.Client(timeout=30) as c:
        resp = c.get(url, headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        return []
    return [t["name"] for t in resp.json().get("value", [])]


def discover_schema_auto(
    workspace_id: str,
    dataset_id: str,
    tenant_id: str,
    client_id: str,
    client_secret: str,
) -> dict:
    """
    Descobre schema completo com fallback automático:
      1. Tenta Scanner Admin API (tabelas + colunas + medidas)
      2. Se falhar (ex: sem permissão), usa GET /tables + EVALUATE TOPN para colunas

    Retorna { "schema_text": str, "error": str|None, "fallback": bool,
              "table_count": int, "measure_count": int }
    """
    # Tenta Scanner primeiro
    result = discover_schema_scanner(
        workspace_id=workspace_id,
        dataset_id=dataset_id,
        tenant_id=tenant_id,
        client_id=client_id,
        client_secret=client_secret,
    )
    if not result.get("error"):
        lines = result["schema_text"].splitlines()
        return {
            **result,
            "fallback": False,
            "table_count":   sum(1 for l in lines if l.startswith("Tabela:")),
            "measure_count": sum(l.count("[") for l in lines if "Medidas:" in l),
        }

    scanner_error = result["error"]

    # Fallback: lista tabelas via API padrão + TOPN por tabela
    token = get_pbi_token(tenant_id, client_id, client_secret)
    table_names = _get_tables_list(dataset_id, token, workspace_id)

    SKIP = {"DateTableTemplate", "LocalDateTable"}
    table_names = [t for t in table_names if not any(t.startswith(s) for s in SKIP)]

    if not table_names:
        return {"schema_text": "", "error": scanner_error, "fallback": True,
                "table_count": 0, "measure_count": 0}

    col_result = explore_tables_columns(dataset_id, token, table_names, workspace_id)

    # Remove linhas "Medidas: (adicione manualmente)" pois não temos medidas no fallback
    clean_lines = [
        l for l in col_result["schema_text"].splitlines()
        if "Medidas: (adicione manualmente)" not in l
    ]
    schema_text = "\n".join(clean_lines).strip()

    if schema_text:
        schema_text += (
            "\n\n# Medidas: não disponíveis sem permissão Admin API\n"
            f"# (Erro Scanner: {scanner_error[:120]})"
        )

    return {
        "schema_text": schema_text,
        "error": None,
        "fallback": True,
        "scanner_error": scanner_error,
        "table_count": len(col_result["tables_found"]),
        "measure_count": 0,
    }


def discover_schema_scanner(
    workspace_id: str,
    dataset_id: str,
    tenant_id: str,
    client_id: str,
    client_secret: str,
) -> dict:
    """
    Descobre schema completo via Power BI Scanner Admin API.
    Requer: "Allow service principals to use read-only Power BI admin APIs" habilitado no tenant.

    Retorna { "schema_text": str, "error": str|None }
    """
    import time

    token = get_pbi_token(tenant_id, client_id, client_secret)
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # 1. Dispara o scan
    scan_url = (
        "https://api.powerbi.com/v1.0/myorg/admin/workspaces/getInfo"
        "?lineage=false&datasourceDetails=false&datasetSchema=true&datasetExpressions=false"
    )
    with httpx.Client(timeout=30) as c:
        resp = c.post(scan_url, headers=headers, json={"workspaces": [workspace_id]})

    if resp.status_code not in (200, 202):
        return {"schema_text": "", "error": f"Scanner API HTTP {resp.status_code}: {resp.text[:500]}"}

    scan_id = resp.json().get("id")
    if not scan_id:
        return {"schema_text": "", "error": "Scanner API não retornou scan ID."}

    # 2. Polling até status Succeeded
    status_url = f"https://api.powerbi.com/v1.0/myorg/admin/workspaces/scanStatus/{scan_id}"
    for _ in range(30):
        time.sleep(2)
        with httpx.Client(timeout=15) as c:
            poll = c.get(status_url, headers=headers)
        status = poll.json().get("status", "")
        if status == "Succeeded":
            break
        if status in ("Failed", "Cancelled"):
            return {"schema_text": "", "error": f"Scan {status}: {poll.text[:300]}"}
    else:
        return {"schema_text": "", "error": "Timeout aguardando Scanner API (60s)."}

    # 3. Busca resultado
    result_url = f"https://api.powerbi.com/v1.0/myorg/admin/workspaces/scanResult/{scan_id}"
    with httpx.Client(timeout=30) as c:
        result_resp = c.get(result_url, headers=headers)

    if result_resp.status_code != 200:
        return {"schema_text": "", "error": f"scanResult HTTP {result_resp.status_code}: {result_resp.text[:300]}"}

    workspaces = result_resp.json().get("workspaces", [])
    if not workspaces:
        return {"schema_text": "", "error": "Nenhum workspace encontrado no resultado."}

    # 4. Encontra o dataset correto
    target_dataset = None
    for ws in workspaces:
        for ds in ws.get("datasets", []):
            if ds.get("id") == dataset_id:
                target_dataset = ds
                break
        if target_dataset:
            break

    if not target_dataset:
        # Tenta pegar qualquer dataset do workspace
        all_ds = [ds for ws in workspaces for ds in ws.get("datasets", [])]
        if all_ds:
            target_dataset = all_ds[0]
        else:
            return {"schema_text": "", "error": "Dataset não encontrado no resultado do scan."}

    # 5. Formata schema
    lines: list[str] = []
    SKIP = {"DateTableTemplate", "LocalDateTable"}

    for table in target_dataset.get("tables", []):
        tname: str = table.get("name", "")
        if any(tname.startswith(s) for s in SKIP):
            continue

        cols = [
            c["name"] for c in table.get("columns", [])
            if not c.get("isHidden") and c.get("columnType") != "RowNumber"
        ]
        measures = [
            m["name"] for m in table.get("measures", [])
            if not m.get("isHidden")
        ]

        lines.append(f"Tabela: {tname}")
        if cols:
            lines.append(f"  Colunas: {', '.join(cols)}")
        if measures:
            lines.append(f"  Medidas: {', '.join(f'[{m}]' for m in measures)}")
        lines.append("")

    return {"schema_text": "\n".join(lines).strip(), "error": None}


def discover_schema(dataset_id: str, token: str, workspace_id: Optional[str] = None) -> dict:
    """
    Descobre schema via DAX INFO functions simples (sem SELECTCOLUMNS/FILTER).
    Retorna { "schema_text": str, "tables": list[str], "error": str|None }
    """
    # ── Tabelas ───────────────────────────────────────────────────────────────
    t_res = execute_dax_query(dataset_id, "EVALUATE INFO.TABLES()", token, workspace_id)
    if t_res.get("error"):
        return {"schema_text": "", "tables": [], "error": f"INFO functions indisponíveis: {t_res['error']}"}

    tables: dict[int, str] = {}
    for row in t_res["rows"]:
        clean = {_clean_key(k): v for k, v in row.items()}
        tid, tname = clean.get("ID"), clean.get("Name")
        hidden = clean.get("IsHidden", False)
        if tid is not None and tname and not hidden:
            tables[tid] = tname

    # ── Colunas ───────────────────────────────────────────────────────────────
    c_res = execute_dax_query(dataset_id, "EVALUATE INFO.COLUMNS()", token, workspace_id)
    table_columns: dict[str, list[str]] = {}
    for row in c_res.get("rows", []):
        clean = {_clean_key(k): v for k, v in row.items()}
        tid    = clean.get("TableID")
        col    = clean.get("ExplicitName") or clean.get("Name")
        hidden = clean.get("IsHidden", False)
        ctype  = clean.get("Type")          # 3 = RowNumber (interno)
        state  = clean.get("State", 1)      # 1 = Ready
        if not col or hidden or ctype == 3 or state != 1:
            continue
        tname = tables.get(tid)
        if tname:
            table_columns.setdefault(tname, []).append(col)

    # ── Medidas ───────────────────────────────────────────────────────────────
    m_res = execute_dax_query(dataset_id, "EVALUATE INFO.MEASURES()", token, workspace_id)
    table_measures: dict[str, list[str]] = {}
    for row in m_res.get("rows", []):
        clean   = {_clean_key(k): v for k, v in row.items()}
        tid     = clean.get("TableID")
        measure = clean.get("Name")
        if not measure:
            continue
        tname = tables.get(tid)
        if tname:
            table_measures.setdefault(tname, []).append(measure)

    # ── Formata schema ────────────────────────────────────────────────────────
    lines: list[str] = []
    SKIP = {"DateTableTemplate", "LocalDateTable"}
    all_names = sorted(set(list(table_columns) + list(table_measures)))
    for tname in all_names:
        if any(tname.startswith(s) for s in SKIP):
            continue
        lines.append(f"Tabela: {tname}")
        cols = table_columns.get(tname, [])
        if cols:
            lines.append(f"  Colunas: {', '.join(cols)}")
        measures = table_measures.get(tname, [])
        if measures:
            lines.append(f"  Medidas: {', '.join(f'[{m}]' for m in measures)}")
        lines.append("")

    return {
        "schema_text": "\n".join(lines).strip(),
        "tables": list(tables.values()),
        "error": None,
    }


# ── Fabric API — definição completa do modelo semântico ───────────────────────

FABRIC_BASE_URL = "https://api.fabric.microsoft.com/v1"


def _get_token(tenant_id: str, client_id: str, client_secret: str, scope: str) -> str:
    url = PBI_TOKEN_URL.format(tenant_id=tenant_id)
    with httpx.Client(timeout=_TIMEOUT) as c:
        resp = c.post(url, data={
            "grant_type":    "client_credentials",
            "client_id":     client_id,
            "client_secret": client_secret,
            "scope":         scope,
        })
        resp.raise_for_status()
        return resp.json()["access_token"]


def _parse_bim(content: str) -> dict:
    """Parseia model.bim (JSON TMSL) e extrai tabelas, colunas e medidas."""
    import json as _json
    try:
        bim = _json.loads(content)
    except Exception as e:
        return {"schema_text": "", "error": f"Erro ao parsear model.bim: {e}"}

    tables = bim.get("model", {}).get("tables", [])
    lines: list[str] = []
    SKIP = {"DateTableTemplate", "LocalDateTable"}

    for tbl in tables:
        name: str = tbl.get("name", "")
        if tbl.get("isHidden") or any(name.startswith(s) for s in SKIP):
            continue

        cols = [
            c["name"] for c in tbl.get("columns", [])
            if not c.get("isHidden") and c.get("type") != "calculated"
        ]
        measures = [m["name"] for m in tbl.get("measures", [])]

        lines.append(f"Tabela: {name}")
        if cols:
            lines.append(f"  Colunas: {', '.join(cols)}")
        if measures:
            lines.append(f"  Medidas: {', '.join(f'[{m}]' for m in measures)}")
        lines.append("")

    return {"schema_text": "\n".join(lines).strip(), "error": None}


def _parse_tmdl(tmdl_parts: dict[str, str]) -> dict:
    """Parseia arquivos TMDL (um por tabela) e extrai colunas e medidas."""
    import re
    lines: list[str] = []
    SKIP = {"DateTableTemplate", "LocalDateTable"}

    for table_name in sorted(tmdl_parts):
        if any(table_name.startswith(s) for s in SKIP):
            continue
        content = tmdl_parts[table_name]

        cols    = re.findall(r'^\s+column\s+(.+)$', content, re.MULTILINE)
        cols    = [c.strip().strip("'\"") for c in cols]
        measures = re.findall(r'^\s+measure\s+(.+?)\s*=', content, re.MULTILINE)
        measures = [m.strip().strip("'\"") for m in measures]

        lines.append(f"Tabela: {table_name}")
        if cols:
            lines.append(f"  Colunas: {', '.join(cols)}")
        if measures:
            lines.append(f"  Medidas: {', '.join(f'[{m}]' for m in measures)}")
        lines.append("")

    return {"schema_text": "\n".join(lines).strip(), "error": None}


def _fabric_get_definition(item_id: str, workspace_id: str, headers: dict) -> dict:
    """Chama /definition para um item_id específico, trata 202 e parseia."""
    import base64, time

    url = f"{FABRIC_BASE_URL}/workspaces/{workspace_id}/semanticmodels/{item_id}/definition"
    with httpx.Client(timeout=120) as c:
        resp = c.get(url, headers=headers)

    # Operação assíncrona
    if resp.status_code == 202:
        op_url = resp.headers.get("Location") or resp.headers.get("location")
        if not op_url:
            return {"schema_text": "", "error": "202 sem Location header."}
        for _ in range(30):
            time.sleep(2)
            with httpx.Client(timeout=30) as c:
                poll = c.get(op_url, headers=headers)
            if poll.status_code == 200:
                resp = poll
                break
            if poll.status_code != 202:
                return {"schema_text": "", "error": f"Polling falhou: {poll.status_code} {poll.text[:300]}"}
        else:
            return {"schema_text": "", "error": "Timeout aguardando definição do modelo (60s)."}

    if resp.status_code != 200:
        return {"schema_text": "", "error": f"HTTP {resp.status_code}: {resp.text[:400]}"}

    parts = resp.json().get("definition", {}).get("parts", [])
    tmdl_tables: dict[str, str] = {}

    for part in parts:
        path: str = part.get("path", "")
        try:
            content = base64.b64decode(part.get("payload", "")).decode("utf-8")
        except Exception:
            continue
        if path.endswith("model.bim"):
            return _parse_bim(content)
        if "/tables/" in path and path.endswith(".tmdl"):
            tbl_name = path.split("/tables/")[-1].removesuffix(".tmdl")
            tmdl_tables[tbl_name] = content

    if tmdl_tables:
        return _parse_tmdl(tmdl_tables)

    return {"schema_text": "", "error": "Nenhum arquivo de definição na resposta."}


def discover_schema_fabric(
    workspace_id: str,
    dataset_id: str,
    tenant_id: str,
    client_id: str,
    client_secret: str,
) -> dict:
    """
    Busca a definição completa do Semantic Model via Fabric REST API.
    1. Tenta com o dataset_id diretamente.
    2. Se 404, lista todos os SemanticModels do workspace e tenta cada um.

    Retorna { "schema_text": str, "error": str|None }
    """
    # 1. Token
    token = None
    last_err = ""
    for scope in [
        "https://api.fabric.microsoft.com/.default",
        "https://analysis.windows.net/powerbi/api/.default",
    ]:
        try:
            token = _get_token(tenant_id, client_id, client_secret, scope)
            break
        except Exception as e:
            last_err = str(e)
    if not token:
        return {"schema_text": "", "error": f"Falha ao obter token: {last_err}"}

    headers = {"Authorization": f"Bearer {token}"}

    # 2. Tenta direto com o dataset_id
    result = _fabric_get_definition(dataset_id, workspace_id, headers)
    if not result.get("error"):
        return result

    first_error = result["error"]

    # 3. Se 404 → lista os semantic models do workspace e tenta cada um
    list_url = f"{FABRIC_BASE_URL}/workspaces/{workspace_id}/semanticmodels"
    with httpx.Client(timeout=30) as c:
        list_resp = c.get(list_url, headers=headers)

    if list_resp.status_code != 200:
        return {"schema_text": "", "error": (
            f"ID direto falhou ({first_error}). "
            f"Listagem também falhou: HTTP {list_resp.status_code} {list_resp.text[:300]}"
        )}

    models = list_resp.json().get("value", [])
    if not models:
        return {"schema_text": "", "error": "Nenhum Semantic Model encontrado no workspace."}

    # Tenta primeiro o que tem o mesmo ID, depois os demais
    ids = sorted(models, key=lambda m: (m.get("id") != dataset_id))
    for model in ids:
        item_id = model.get("id")
        if not item_id:
            continue
        res = _fabric_get_definition(item_id, workspace_id, headers)
        if not res.get("error"):
            return res

    # Coleta erros de cada tentativa para diagnóstico
    errors_detail = []
    for model in ids:
        item_id = model.get("id")
        name    = model.get("displayName", "?")
        if not item_id:
            continue
        res = _fabric_get_definition(item_id, workspace_id, headers)
        if not res.get("error"):
            return res
        errors_detail.append(f"{name} ({item_id}): {res['error']}")

    return {"schema_text": "", "error": "Falha em todos os modelos:\n" + "\n".join(errors_detail)}


def format_rows_for_llm(result: dict, max_rows: int = 200) -> str:
    """Converte o resultado de execute_dax_query em texto markdown para o LLM."""
    if result is None:
        return "❌ A consulta não retornou resultado (None)."
    if not isinstance(result, dict):
        return f"❌ Resultado inesperado: {type(result)}"
    if result.get("error"):
        return f"❌ Erro na consulta DAX:\n```\n{result['error']}\n```\nQuery executada:\n```dax\n{result.get('dax_query','')}\n```"

    rows = result.get("rows", [])
    if not rows:
        return "A consulta não retornou dados."

    # Cabeçalho da tabela
    headers = list(rows[0].keys())
    # Limpa os nomes das colunas (Power BI retorna "Tabela[Coluna]" → mostra só "Coluna")
    clean_headers = [h.split("[")[-1].rstrip("]") if "[" in h else h for h in headers]
