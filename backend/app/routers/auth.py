from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.access_log import AccessLog
from app.schemas.token import Token
from app.utils.security import verify_password, create_access_token, get_current_user
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["Auth"])

@router.post("/login", response_model=Token)
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="E-mail ou senha inválidos")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuário bloqueado. Entre em contato com o administrador.")
    
    token = create_access_token({"sub": str(user.id), "role": user.role})
    user.last_login = datetime.utcnow()
    
    log = AccessLog(user_id=user.id, action="login",
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"))
    db.add(log)
    db.commit()
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "name": user.name, "email": user.email,
                 "role": user.role, "client_id": user.client_id, "avatar_url": user.avatar_url}
    }

@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "name": current_user.name, "email": current_user.email,
            "role": current_user.role, "client_id": current_user.client_id, "avatar_url": current_user.avatar_url}

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    log = AccessLog(user_id=current_user.id, action="logout")
    db.add(log)
    db.commit()
    return {"message": "Logout realizado com sucesso"}
