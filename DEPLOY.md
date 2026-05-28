# Guia de Deploy — Supabase + Railway

Este guia leva o Portal BI do seu computador para a internet em ~30 minutos.

---

## Visão geral da arquitetura em produção

```
Internet
   │
   ├── Frontend (Railway)   → React buildado + Nginx
   │        │
   │        └──► Backend (Railway) → FastAPI
   │                  │
   │                  ├──► Supabase PostgreSQL   (banco de dados)
   │                  └──► Supabase Storage      (imagens + Parquet)
```

---

## PARTE 1 — Configurar o Supabase

### 1.1 Criar conta e projeto
1. Acesse **https://supabase.com** → "Start your project" → crie uma conta
2. Clique em **"New project"**
3. Preencha:
   - **Name:** portal-bi
   - **Database Password:** anote esta senha, você vai precisar
   - **Region:** South America (São Paulo)
4. Aguarde ~2 minutos enquanto o projeto é criado

### 1.2 Pegar a string de conexão do banco
1. No painel do projeto → **Settings → Database**
2. Role até **"Connection String"** → selecione **"URI"**
3. Troque a aba para **"Transaction mode"** (porta **6543**)
4. Copie a string — ela ficará assim:
   ```
   postgresql://postgres.xxxx:[SUA-SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
   ```
5. Guarde essa string — será a `DATABASE_URL` no Railway

### 1.3 Pegar as chaves de API
1. **Settings → API**
2. Copie:
   - **Project URL** → será `SUPABASE_URL`
   - **service_role** (clique em "Reveal") → será `SUPABASE_SERVICE_KEY`
   > ⚠️ A chave `service_role` dá acesso total — nunca exponha no frontend

### 1.4 Criar os buckets de Storage
1. No menu lateral → **Storage → New bucket**
2. Crie o bucket **`covers`**:
   - Public bucket: **✅ SIM** (imagens de capa precisam de URL pública)
3. Crie o bucket **`parquet`**:
   - Public bucket: **❌ NÃO** (arquivos de dados são privados)

### 1.5 Configurar política de acesso (covers)
1. Storage → `covers` → **Policies → New policy**
2. Escolha **"For full customization"**
3. Policy name: `public-read`
4. Allowed operations: **SELECT**
5. USING expression: `true`
6. Salve

---

## PARTE 2 — Publicar no Railway

### 2.1 Criar conta e instalar a CLI (opcional)
1. Acesse **https://railway.app** → entre com GitHub
2. CLI (opcional): `npm install -g @railway/cli` → `railway login`

### 2.2 Subir o código para o GitHub
O Railway faz deploy direto do GitHub. Se você ainda não tem o repositório:

```bash
# Na pasta portal-bi
git init
git add .
git commit -m "Portal BI - primeiro deploy"

# Crie um repositório no github.com e depois:
git remote add origin https://github.com/SEU-USUARIO/portal-bi.git
git push -u origin main
```

### 2.3 Criar o projeto no Railway
1. Railway → **"New Project" → "Deploy from GitHub repo"**
2. Selecione o repositório `portal-bi`
3. Railway vai detectar dois serviços possíveis (backend e frontend)

### 2.4 Configurar o serviço Backend
1. Railway → seu projeto → **"Add Service" → "GitHub Repo"**
2. Selecione o repo → em **"Root Directory"** coloque: `backend`
3. Em **"Variables"**, adicione todas as variáveis abaixo:

| Variável | Valor |
|----------|-------|
| `SECRET_KEY` | chave gerada (32 bytes hex) |
| `DATABASE_URL` | string do Supabase (porta 6543) |
| `OPENAI_API_KEY` | sua chave OpenAI |
| `OPENAI_MODEL` | `gpt-4o` |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | service_role key do Supabase |
| `SUPABASE_BUCKET_COVERS` | `covers` |
| `SUPABASE_BUCKET_PARQUET` | `parquet` |
| `FRONTEND_URL` | URL do frontend (preencha depois) |

4. Clique em **"Deploy"** e aguarde o build (~3-5 min)
5. Após o deploy, copie a URL gerada (ex: `https://portal-bi-backend.up.railway.app`)

### 2.5 Configurar o serviço Frontend
1. Railway → **"Add Service" → "GitHub Repo"** (mesmo repo)
2. Root Directory: `frontend`
3. Em **"Variables"**, adicione:

| Variável | Valor |
|----------|-------|
| `VITE_API_URL` | URL do backend (ex: `https://portal-bi-backend.up.railway.app`) |

4. Clique em **"Deploy"** e aguarde (~2-3 min)
5. Copie a URL do frontend (ex: `https://portal-bi-frontend.up.railway.app`)

### 2.6 Atualizar CORS no backend
1. Volte ao serviço Backend → **Variables**
2. Atualize `FRONTEND_URL` com a URL real do frontend
3. Railway fará redeploy automático

---

## PARTE 3 — Primeiro acesso

1. Abra a URL do frontend no navegador
2. Faça login com:
   ```
   E-mail:  admin@portalbi.com
   Senha:   Admin@123
   ```
3. **Troque a senha imediatamente** em qualquer editor de usuário

---

## PARTE 4 — Domínio personalizado (opcional)

### No Railway
1. Serviço Frontend → **Settings → Domains → Custom Domain**
2. Digite seu domínio (ex: `bi.suaempresa.com.br`)
3. Railway mostrará um registro CNAME para configurar no DNS

### No seu provedor de DNS
- Adicione o registro CNAME apontando para o domínio do Railway
- Aguarde propagação (5-60 minutos)
- Railway emite SSL automaticamente via Let's Encrypt

---

## Checklist de verificação pós-deploy

- [ ] Frontend abre e mostra tela de login
- [ ] Login com admin funciona
- [ ] API docs acessível em `https://seu-backend.railway.app/api/docs`
- [ ] Cadastro de dashboard funciona
- [ ] Upload de imagem de capa salva no Supabase Storage
- [ ] Upload de Parquet funciona
- [ ] Assistente de IA responde perguntas
- [ ] Usuário externo acessa apenas dashboards liberados

---

## Variáveis de ambiente — Referência completa

```env
# Backend (Railway)
SECRET_KEY=              # python -c "import secrets; print(secrets.token_hex(32))"
DATABASE_URL=            # postgresql://postgres.xxx:senha@pooler.supabase.com:6543/postgres
OPENAI_API_KEY=          # sk-proj-...
OPENAI_MODEL=            # gpt-4o
SUPABASE_URL=            # https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=    # eyJ... (service_role)
SUPABASE_BUCKET_COVERS=  # covers
SUPABASE_BUCKET_PARQUET= # parquet
FRONTEND_URL=            # https://portal-bi-frontend.up.railway.app

# Frontend (Railway)
VITE_API_URL=            # https://portal-bi-backend.up.railway.app
```

---

## Troubleshooting

**Build falha com erro de psycopg2**
→ O Dockerfile já instala `libpq-dev`. Se o erro persistir, verifique se o Railway está usando o Dockerfile (`railway.toml` em `backend/`).

**CORS error no navegador**
→ Verifique se `FRONTEND_URL` no backend está com a URL exata do frontend (sem barra no final).

**Supabase Storage: upload retorna 403**
→ Confirme que a `SUPABASE_SERVICE_KEY` é a chave `service_role`, não a `anon`.

**AI Assistant: "Erro ao processar"**
→ Verifique `OPENAI_API_KEY` e se o modelo `gpt-4o` está disponível na sua conta OpenAI.

**Banco de dados: connection refused**
→ Use a string de conexão com porta **6543** (Transaction mode), não 5432.
