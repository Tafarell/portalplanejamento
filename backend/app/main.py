from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.config import settings
from app.database import Base, engine
from app.models import *  # garante que todos os models são importados antes do create_all
from app.routers import auth, users, clients, dashboards, permissions, access_logs, ai_assistant
from app.routers import grupos, contratos, categories, powerbi
from app.utils.security import hash_password

app = FastAPI(
    title="Portal do Planejamento API",
    description="API do Portal de Planejamento & BI",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    _seed_admin()
    _seed_categories()

def _run_migrations():
    """Adiciona colunas novas às tabelas existentes (idempotente)."""
    migrations = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_use_ai BOOLEAN DEFAULT FALSE",
        "ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS contrato_id INTEGER REFERENCES contratos(id)",
        "ALTER TABLE permissions ADD COLUMN IF NOT EXISTS scope VARCHAR(20) DEFAULT 'dashboard'",
        "ALTER TABLE permissions ADD COLUMN IF NOT EXISTS contrato_id INTEGER REFERENCES contratos(id)",
        "ALTER TABLE permissions ADD COLUMN IF NOT EXISTS grupo_id INTEGER REFERENCES clients(id)",
        "ALTER TABLE permissions ALTER COLUMN dashboard_id DROP NOT NULL",
        # Converte category de ENUM para VARCHAR para suportar categorias dinâmicas
        "ALTER TABLE dashboards ALTER COLUMN category TYPE VARCHAR(50) USING category::VARCHAR",
        "UPDATE dashboards SET category = LOWER(category) WHERE category IS NOT NULL AND category <> LOWER(category)",
        "ALTER TABLE pbi_connections ADD COLUMN IF NOT EXISTS workspace_id VARCHAR(300)",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                conn.rollback()

def _seed_categories():
    """Cria categorias padrão se não existirem."""
    from app.database import SessionLocal
    from app.models.category import Category
    db = SessionLocal()
    try:
        if db.query(Category).count() == 0:
            defaults = [
                Category(name="Dashboards", slug="bi", icon="BarChart3", order=0),
                Category(name="Aplicativos", slug="app", icon="Monitor", order=1),
                Category(name="Relatórios", slug="report", icon="FileText", order=2),
            ]
            db.add_all(defaults)
            db.commit()
            print("✅ Categorias padrão criadas")
    finally:
        db.close()

def _seed_admin():
    """Cria o usuário administrador padrão se não existir."""
    from app.database import SessionLocal
    from app.models.user import User, UserRole
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.email == "admin@portalbi.com").first():
            admin = User(
                name="Administrador",
                email="admin@portalbi.com",
                hashed_password=hash_password("Admin@123"),
                role=UserRole.ADMIN,
                is_active=True
            )
            db.add(admin)
            db.commit()
            print("✅ Usuário admin criado: admin@portalbi.com / Admin@123")
    finally:
        db.close()

# Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(clients.router)       # mantido para compatibilidade
app.include_router(grupos.router)
app.include_router(contratos.router)
app.include_router(dashboards.router)
app.include_router(permissions.router)
app.include_router(access_logs.router)
app.include_router(ai_assistant.router)
app.include_router(categories.router)
app.include_router(powerbi.router)

@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME}
