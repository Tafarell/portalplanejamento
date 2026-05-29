from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.database import get_db
from app.models.category import Category
from app.utils.security import get_current_user, require_admin

router = APIRouter(prefix="/api/categories", tags=["Categories"])

class CategoryOut(BaseModel):
    id: int
    name: str
    slug: str
    icon: Optional[str] = None
    order: int
    is_active: bool

    model_config = {"from_attributes": True}

class CategoryCreate(BaseModel):
    name: str
    slug: str
    icon: Optional[str] = None
    order: int = 0
    is_active: bool = True

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    icon: Optional[str] = None
    order: Optional[int] = None
    is_active: Optional[bool] = None

@router.get("/", response_model=List[CategoryOut])
def list_categories(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(Category).order_by(Category.order, Category.name).all()

@router.get("/active", response_model=List[CategoryOut])
def list_active_categories(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(Category).filter(Category.is_active == True).order_by(Category.order, Category.name).all()

@router.post("/", response_model=CategoryOut)
def create_category(data: CategoryCreate, db: Session = Depends(get_db), admin=Depends(require_admin)):
    if db.query(Category).filter(Category.slug == data.slug).first():
        raise HTTPException(status_code=400, detail="Slug já existe")
    cat = Category(**data.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat

@router.put("/{cat_id}", response_model=CategoryOut)
def update_category(cat_id: int, data: CategoryUpdate, db: Session = Depends(get_db), admin=Depends(require_admin)):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(cat, field, value)
    db.commit()
    db.refresh(cat)
    return cat

@router.delete("/{cat_id}")
def delete_category(cat_id: int, db: Session = Depends(get_db), admin=Depends(require_admin)):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    db.delete(cat)
    db.commit()
    return {"message": "Categoria removida"}
