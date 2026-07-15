from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.ai_employee import AIEmployee
from app.schemas.employee import EmployeeCreate, EmployeeOut

router = APIRouter()


@router.post("", response_model=EmployeeOut)
def create_employee(payload: EmployeeCreate, db: Session = Depends(get_db)):
    existing = db.query(AIEmployee).filter(AIEmployee.role == payload.role).first()
    if existing:
        raise HTTPException(status_code=400, detail="Employee with this role already exists")

    employee = AIEmployee(
        name=payload.name,
        role=payload.role,
        permissions=payload.permissions or {},
        connected_tools=payload.connected_tools or [],
        knowledge_collection=payload.knowledge_collection or "finance_officer_knowledge",
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


@router.get("", response_model=list[EmployeeOut])
def list_employees(db: Session = Depends(get_db)):
    return db.query(AIEmployee).all()
