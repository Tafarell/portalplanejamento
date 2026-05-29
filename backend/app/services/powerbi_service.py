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

    data = resp.json()

    # Erros de nível HTTP
    if resp.status_code >= 400:
        err = data.get("error", {})
        return {
            "rows": [],
            "count": 0,
            "dax_query": dax_query,
            "error": err.get("message") or resp.text,
        }

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


def format_rows_for_llm(result: dict, max_rows: int = 200) -> str:
    """Converte o resultado de execute_dax_query em texto markdown para o LLM."""
    if result.get("error"):
        return f"❌ Erro na consulta DAX:\n```\n{result['error']}\n```\nQuery executada:\n```dax\n{result['dax_query']}\n```"

    rows = result["rows"]
    if not rows:
        return "A consulta não retornou dados."

    # Cabeçalho da tabela
    headers = list(rows[0].keys())
    # Limpa os nomes das colunas (Power BI retorna "Tabela[Coluna]" → mostra só "Coluna")
    clean_headers = [h.split("[")[-1].rstrip("]") if "[" in h else h for h in headers]

    lines = ["| " + " | ".join(clean_headers) + " |"]
    lines.append("| " + " | ".join("---" for _ in clean_headers) + " |")

    for row in rows[:max_rows]:
        vals = [str(row.get(h, "")) for h in headers]
        lines.append("| " + " | ".join(vals) + " |")

    suffix = f"\n\n*Exibindo {min(max_rows, len(rows))} de {result['count']} linhas.*" if result["count"] > max_rows else ""
    return "\n".join(lines) + suffix
