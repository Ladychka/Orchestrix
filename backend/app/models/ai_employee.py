from sqlalchemy import Column, Integer, String, DateTime, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base


class AIEmployee(Base):
    __tablename__ = "ai_employees"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False, unique=True)
    permissions = Column(JSON, default=dict)
    connected_tools = Column(JSON, default=list)
    knowledge_collection = Column(String, default="finance_officer_knowledge")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tasks = relationship("Task", back_populates="employee")
