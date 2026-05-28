# Portal BI — Guia de Instalação e Uso

Portal corporativo completo para centralizar dashboards de BI, aplicativos internos e externos, com controle de acesso por usuário/cliente e assistente de IA integrado.

---

## Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Backend | FastAPI (Python 3.11) |
| Frontend | React 18 + Tailwind CSS |
| Banco de dados | PostgreSQL 16 |
| IA | OpenAI GPT-4o |
| Deploy | Docker + Docker Compose |

---

## Pré-requisitos

- Docker e Docker Compose instalados no servidor
- Chave de API da OpenAI (https://platform.openai.com)

---

## Instalação (5 passos)

### 1. Clone ou copie o projeto para o servidor
```bash
cd /opt
# copie a pasta portal-bi para o servidor
cd portal-bi
```

### 2. Configure as variáveis de ambiente
```bash
cp .env.example .env
nano .env  # edite as variáveis abaixo
```

Variáveis obrigatórias:
```env
SECRET_KEY=gere-uma-chave-com-openssl-rand-hex-32
OPENAI_API_KEY=sk-proj-...
```

### 3. Suba os containers
```bash
docker compose up -d --build
```

### 4. Acesse o portal
- **Portal:** http://seu-servidor
- **API Docs:** http://seu-servidor:8000/api/docs

### 5. Primeiro acesso — usuário administrador padrão
```
E-mail:  admin@portalbi.com
Senha:   Admin@123
```
**Troque a senha imediatamente após o primeiro login.**

---

## HTTPS com domínio próprio (recomendado para produção)

```bash
# Instale o Certbot no servidor
apt install certbot nginx -y

# Edite o arquivo nginx/nginx.conf com seu domínio real
# Obtenha o certificado SSL
certbot --nginx -d seu-dominio.com.br

# Reinicie o Nginx
systemctl restart nginx
```

---

## Comandos úteis

```bash
# Ver status dos containers
docker compose ps

# Ver logs do backend
docker compose logs backend -f

# Reiniciar serviço
docker compose restart backend

# Parar tudo
docker compose down

# Backup do banco
docker exec portal_bi_db pg_dump -U portal_user portal_bi > backup.sql

# Restaurar backup
docker exec -i portal_bi_db psql -U portal_user portal_bi < backup.sql
```

---

## Guia de Uso

### Perfis de usuário
| Perfil | Acesso |
|--------|--------|
| `admin` | Painel completo: usuários, dashboards, clientes, permissões, logs |
| `internal` | Dashboards liberados + Assistente IA |
| `external` | Apenas dashboards liberados para seu cliente |

### Fluxo de configuração recomendado
1. Cadastre os **Clientes** (empresas)
2. Cadastre os **Dashboards** (nome, link embed, capa, tags, contexto DAX)
3. Faça upload do arquivo **Parquet** para habilitar o Assistente IA
4. Cadastre os **Usuários** vinculados aos clientes
5. Configure as **Permissões** (qual usuário acessa qual dashboard)

### Assistente de IA
- O assistente responde perguntas sobre dados dos dashboards
- Para máxima precisão: preencha o campo **Contexto DAX** com a descrição das medidas
- Faça upload do arquivo **Parquet** com os dados do dashboard
- Exemplos de perguntas:
  - "Qual o faturamento do mês de maio?"
  - "Compare este mês com o anterior"
  - "Quais contratos tiveram pior desempenho?"
  - "Explique a queda no indicador X"

---

## Estrutura do Projeto

```
portal-bi/
├── backend/           # FastAPI + SQLAlchemy
│   └── app/
│       ├── models/    # Modelos do banco de dados
│       ├── routers/   # Endpoints da API
│       ├── schemas/   # Validação Pydantic
│       └── services/  # Lógica de IA
├── frontend/          # React + Tailwind
│   └── src/
│       ├── pages/     # Páginas (Home, Login, Admin)
│       ├── components/ # Componentes reutilizáveis
│       └── context/   # Contexto de autenticação
├── nginx/             # Config Nginx para HTTPS
├── docker-compose.yml
└── .env.example
```

---

## Segurança e LGPD

- Autenticação via JWT com expiração configurável
- Senhas armazenadas com hash bcrypt
- Separação de dados por cliente (client_id)
- Log de todos os acessos (login, dashboards, consultas IA)
- Suporte a bloqueio de usuário sem exclusão de dados
- Variáveis sensíveis via arquivo .env (nunca versionado)

---

## Suporte

Para dúvidas, configurações avançadas ou integrações com Power BI, Azure OpenAI ou APIs externas, consulte a documentação da API em `/api/docs`.
