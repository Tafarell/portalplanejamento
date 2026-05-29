from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from app.models.user import UserRole

class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: UserRole = UserRole.EXTERNAL
    client_id: Optional[int] = None
    is_active: bool = True
    can_use_ai: bool = False

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    client_id: Optional[int] = None
    is_active: Optional[bool] = None
    can_use_ai: Optional[bool] = None
    password: Optional[str] = None

class UserOut(UserBase):
    id: int
    avatar_url: Optional[str] = None
    can_use_ai: bool = False
    created_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True
