from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import Base, engine
from app.models import *  # garante que todos os models são importados antes do create_all
from app.routers import auth, users, clients, dashboards, permissions, access_logs, ai_assistant
from app.utils.security import hash_password

app = FastAPI(
    title="Portal BI API",
    description="API do Portal de Business Intelligence",
    version="1.0.0",
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

# Criar tabelas no banco e seed do admin
@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    _seed_admin()

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
app.include_router(clients.router)
app.include_router(dashboards.router)
app.include_router(permissions.router)
app.include_router(access_logs.router)
app.include_router(ai_assistant.router)

@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME}
