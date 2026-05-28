#!/usr/bin/env python3
"""
Portal BI — Script de Setup Automático
======================================
Executa toda a configuração inicial:
  1. Lê/cria o arquivo .env com suas credenciais
  2. Cria os buckets no Supabase Storage
  3. Configura política pública no bucket de capas
  4. Testa a conexão com o banco de dados PostgreSQL
  5. Inicializa o repositório Git
  6. Exibe as instruções finais para o Railway

Uso:
  python setup.py
"""

import os
import sys
import subprocess
import textwrap

# ─────────────────────────────────────────────
# Helpers de output
# ─────────────────────────────────────────────

VERDE  = "\033[92m"
AMARELO = "\033[93m"
VERMELHO = "\033[91m"
AZUL   = "\033[94m"
RESET  = "\033[0m"
NEGRITO = "\033[1m"

def ok(msg):    print(f"  {VERDE}✔{RESET}  {msg}")
def erro(msg):  print(f"  {VERMELHO}✘{RESET}  {msg}")
def info(msg):  print(f"  {AZUL}→{RESET}  {msg}")
def warn(msg):  print(f"  {AMARELO}⚠{RESET}  {msg}")
def titulo(msg):
    print(f"\n{NEGRITO}{AZUL}{'─'*55}{RESET}")
    print(f"{NEGRITO}{AZUL}  {msg}{RESET}")
    print(f"{NEGRITO}{AZUL}{'─'*55}{RESET}")

def perguntar(prompt, padrao=None):
    sufixo = f" [{padrao}]" if padrao else ""
    resposta = input(f"  {AMARELO}?{RESET}  {prompt}{sufixo}: ").strip()
    return resposta if resposta else padrao

# ─────────────────────────────────────────────
# 1. Verificar dependências
# ─────────────────────────────────────────────

def verificar_dependencias():
    titulo("1/5  Verificando dependências")
    deps = ["supabase", "psycopg2", "dotenv"]
    faltando = []
    for dep in deps:
        try:
            mod = "python_dotenv" if dep == "dotenv" else dep.replace("-", "_")
            __import__(mod)
            ok(dep)
        except ImportError:
            faltando.append(dep)
            warn(f"{dep} não instalado")

    if faltando:
        info("Instalando dependências...")
        pkg_map = {"dotenv": "python-dotenv", "psycopg2": "psycopg2-binary"}
        for dep in faltando:
            pkg = pkg_map.get(dep, dep)
            subprocess.check_call([sys.executable, "-m", "pip", "install", pkg, "-q"])
            ok(f"{dep} instalado")

# ─────────────────────────────────────────────
# 2. Criar / carregar .env
# ─────────────────────────────────────────────

ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")

def carregar_env():
    from dotenv import dotenv_values
    return dotenv_values(ENV_PATH) if os.path.exists(ENV_PATH) else {}

def salvar_env(valores: dict):
    linhas = []
    for k, v in valores.items():
        linhas.append(f'{k}="{v}"')
    with open(ENV_PATH, "w") as f:
        f.write("\n".join(linhas) + "\n")

def configurar_env():
    titulo("2/5  Configurar credenciais (.env)")

    env = carregar_env()

    if env.get("SUPABASE_URL") and env.get("SUPABASE_SERVICE_KEY") and env.get("DATABASE_URL"):
        ok("Arquivo .env encontrado com credenciais")
        usar = perguntar("Usar as credenciais existentes? (s/n)", "s")
        if usar.lower() in ("s", "sim", ""):
            return env

    print(f"\n  {AMARELO}Preencha as informações do Supabase:{RESET}")
    print("  (Supabase → Settings → API / Database)\n")

    supabase_url       = perguntar("SUPABASE_URL (ex: https://xxxx.supabase.co)", env.get("SUPABASE_URL", ""))
    supabase_key       = perguntar("SUPABASE_SERVICE_KEY (service_role key)",     env.get("SUPABASE_SERVICE_KEY", ""))
    database_url       = perguntar("DATABASE_URL (porta 6543 — Transaction mode)", env.get("DATABASE_URL", ""))
    openai_key         = perguntar("OPENAI_API_KEY (sk-proj-...)",                env.get("OPENAI_API_KEY", ""))
    secret_key         = env.get("SECRET_KEY") or _gerar_secret_key()
    frontend_url       = perguntar("URL do frontend no Railway (preencha depois)", env.get("FRONTEND_URL", "https://portal-bi-frontend.up.railway.app"))

    novo_env = {
        "SECRET_KEY":               secret_key,
        "DATABASE_URL":             database_url,
        "OPENAI_API_KEY":           openai_key,
        "OPENAI_MODEL":             "gpt-4o",
        "SUPABASE_URL":             supabase_url,
        "SUPABASE_SERVICE_KEY":     supabase_key,
        "SUPABASE_BUCKET_COVERS":   "covers",
        "SUPABASE_BUCKET_PARQUET":  "parquet",
        "FRONTEND_URL":             frontend_url,
    }

    salvar_env(novo_env)
    ok(f".env salvo em {ENV_PATH}")
    return novo_env

def _gerar_secret_key():
    import secrets
    key = secrets.token_hex(32)
    info(f"SECRET_KEY gerada automaticamente: {key[:16]}…")
    return key

# ─────────────────────────────────────────────
# 3. Configurar Supabase Storage
# ─────────────────────────────────────────────

def configurar_supabase(env):
    titulo("3/5  Configurar Supabase Storage")

    from supabase import create_client

    url = env["SUPABASE_URL"]
    key = env["SUPABASE_SERVICE_KEY"]

    try:
        sb = create_client(url, key)
        ok("Conexão com Supabase estabelecida")
    except Exception as e:
        erro(f"Falha ao conectar no Supabase: {e}")
        sys.exit(1)

    # Buckets a criar: (nome, é_público)
    buckets = [
        ("covers",  True,  "Imagens de capa dos dashboards"),
        ("parquet", False, "Arquivos de dados Parquet (privado)"),
    ]

    for nome, publico, descricao in buckets:
        try:
            buckets_existentes = [b.name for b in sb.storage.list_buckets()]
            if nome in buckets_existentes:
                ok(f"Bucket '{nome}' já existe — {descricao}")
            else:
                sb.storage.create_bucket(nome, options={"public": publico})
                ok(f"Bucket '{nome}' criado ({descricao})")
        except Exception as e:
            if "already exists" in str(e).lower():
                ok(f"Bucket '{nome}' já existe")
            else:
                erro(f"Erro ao criar bucket '{nome}': {e}")

    # Política de leitura pública para 'covers'
    try:
        sb.postgrest.schema("storage").from_("buckets").update(
            {"public": True}
        ).eq("name", "covers").execute()
        ok("Bucket 'covers' configurado como público")
    except Exception as e:
        warn(f"Não foi possível configurar política via API ({e})")
        warn("Se necessário, configure manualmente: Storage → covers → Policies → Allow public read")

    return sb

# ─────────────────────────────────────────────
# 4. Testar banco de dados
# ─────────────────────────────────────────────

def testar_banco(env):
    titulo("4/5  Testando conexão com o banco de dados")

    import psycopg2

    db_url = env["DATABASE_URL"]
    try:
        conn = psycopg2.connect(db_url, connect_timeout=10)
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        versao = cursor.fetchone()[0].split(",")[0]
        conn.close()
        ok(f"PostgreSQL conectado: {versao}")
    except Exception as e:
        erro(f"Falha na conexão com o banco: {e}")
        warn("Verifique se a DATABASE_URL usa porta 6543 (Transaction mode) do Supabase")
        warn("Exemplo: postgresql://postgres.xxxx:senha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres")

# ─────────────────────────────────────────────
# 5. Inicializar Git
# ─────────────────────────────────────────────

def configurar_git():
    titulo("5/5  Preparar repositório Git")

    raiz = os.path.dirname(os.path.abspath(__file__))

    # .gitignore
    gitignore_path = os.path.join(raiz, ".gitignore")
    gitignore = textwrap.dedent("""\
        .env
        __pycache__/
        *.pyc
        .DS_Store
        node_modules/
        dist/
        .venv/
        venv/
        *.egg-info/
        .pytest_cache/
        uploads/
        data/
        *.parquet
    """)
    with open(gitignore_path, "w") as f:
        f.write(gitignore)
    ok(".gitignore criado (protege .env e uploads)")

    # Inicializar git se necessário
    git_dir = os.path.join(raiz, ".git")
    if not os.path.isdir(git_dir):
        subprocess.run(["git", "init"], cwd=raiz, capture_output=True)
        ok("Repositório Git inicializado")
    else:
        ok("Repositório Git já existe")

    # Commit inicial
    try:
        subprocess.run(["git", "add", "."], cwd=raiz, capture_output=True)
        result = subprocess.run(
            ["git", "commit", "-m", "Portal BI - configuração inicial + Supabase + Railway"],
            cwd=raiz, capture_output=True, text=True
        )
        if "nothing to commit" in result.stdout or result.returncode == 0:
            ok("Commit criado com sucesso")
        else:
            warn(f"Git commit: {result.stderr.strip()[:80]}")
    except FileNotFoundError:
        warn("Git não encontrado no PATH. Instale o Git e rode: git add . && git commit -m 'setup'")

# ─────────────────────────────────────────────
# 6. Resumo final
# ─────────────────────────────────────────────

def resumo_final(env):
    titulo("✅  Setup concluído! Próximos passos")

    print(f"""
  {NEGRITO}1. Enviar para o GitHub:{RESET}
     Crie um repositório em https://github.com/new e rode:

     git remote add origin https://github.com/SEU-USUARIO/portal-bi.git
     git push -u origin main

  {NEGRITO}2. Criar serviço Backend no Railway:{RESET}
     railway.app → New Project → GitHub → Root Directory: backend
     Cole as variáveis de {ENV_PATH}

  {NEGRITO}3. Criar serviço Frontend no Railway:{RESET}
     Add Service → GitHub (mesmo repo) → Root Directory: frontend
     Variável: VITE_API_URL = URL do backend gerado pelo Railway

  {NEGRITO}4. Após o deploy, acesse o portal com:{RESET}
     E-mail:  admin@portalbi.com
     Senha:   Admin@123  ← troque imediatamente!

  {NEGRITO}Supabase Storage:{RESET}
     Bucket 'covers'  → público  (imagens de capa)
     Bucket 'parquet' → privado  (dados para IA)

  {AMARELO}Dica: Consulte o arquivo DEPLOY.md para o guia completo.{RESET}
""")

# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────

if __name__ == "__main__":
    print(f"\n{NEGRITO}{AZUL}{'═'*55}")
    print("   Portal BI — Setup Automático")
    print(f"{'═'*55}{RESET}")

    verificar_dependencias()
    env = configurar_env()
    configurar_supabase(env)
    testar_banco(env)
    configurar_git()
    resumo_final(env)
