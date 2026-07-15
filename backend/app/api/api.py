from fastapi import APIRouter

from app.api.endpoints import employees, tasks

api_router = APIRouter()
api_router.include_router(employees.router, prefix="/employees", tags=["employees"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
