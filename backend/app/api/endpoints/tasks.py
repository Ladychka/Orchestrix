from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.task import Task, TaskStatus
from app.models.ai_employee import AIEmployee
from app.schemas.task import TaskCreate, TaskOut, TaskListOut
from app.orchestrator.engine import run_task

router = APIRouter()


@router.post("", response_model=TaskListOut)
def create_task(
    payload: TaskCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    employee = db.query(AIEmployee).filter(AIEmployee.id == payload.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    task = Task(
        employee_id=payload.employee_id,
        trigger_source="manual",
        input_payload={
            "from": payload.from_email,
            "subject": payload.subject,
            "body": payload.body,
        },
        status=TaskStatus.received,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    background_tasks.add_task(run_task, task.id)
    return task


@router.get("", response_model=list[TaskListOut])
def list_tasks(db: Session = Depends(get_db)):
    return db.query(Task).order_by(Task.created_at.desc()).all()


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task
