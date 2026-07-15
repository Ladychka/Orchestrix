from pydantic import BaseModel
from datetime import datetime
from typing import Any


class EmployeeCreate(BaseModel):
    name: str
    role: str
    permissions: dict[str, Any] | None = None
    connected_tools: list[str] | None = None
    knowledge_collection: str | None = "finance_officer_knowledge"


class EmployeeOut(BaseModel):
    id: int
    name: str
    role: str
    permissions: dict[str, Any]
    connected_tools: list[str]
    knowledge_collection: str
    created_at: datetime

    class Config:
        from_attributes = True
