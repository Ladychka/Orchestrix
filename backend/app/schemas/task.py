from pydantic import BaseModel
from datetime import datetime
from typing import Any

from app.models.task import TaskStatus


class TaskCreate(BaseModel):
    from_email: str
    subject: str
    body: str
    employee_id: int = 1


class TaskStepOut(BaseModel):
    id: int
    step_number: int
    tool_called: str | None
    tool_input: Any
    tool_output: Any
    created_at: datetime

    class Config:
        from_attributes = True


class TaskOut(BaseModel):
    id: int
    employee_id: int
    trigger_source: str
    input_payload: dict[str, Any]
    status: TaskStatus
    created_at: datetime
    updated_at: datetime | None
    steps: list[TaskStepOut]

    class Config:
        from_attributes = True


class TaskListOut(BaseModel):
    id: int
    employee_id: int
    trigger_source: str
    status: TaskStatus
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True
