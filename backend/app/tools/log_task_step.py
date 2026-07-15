"""Tool: log_task_step — write an audit entry to the TaskStep table."""

from app.database import SessionLocal
from app.models.task_step import TaskStep


def log_task_step(task_id: int, step_data: dict) -> dict:
    """Persist a step record for audit/tracing.

    Args:
        task_id: The parent Task ID.
        step_data: Dict expected to contain step_number, tool_called,
                   tool_input, and tool_output.

    Returns:
        The created step as a dict.
    """
    db = SessionLocal()
    try:
        step = TaskStep(
            task_id=task_id,
            step_number=step_data.get("step_number", 0),
            tool_called=step_data.get("tool_called"),
            tool_input=step_data.get("tool_input") or {},
            tool_output=step_data.get("tool_output") or {},
        )
        db.add(step)
        db.commit()
        db.refresh(step)
        return {
            "id": step.id,
            "task_id": step.task_id,
            "step_number": step.step_number,
            "tool_called": step.tool_called,
        }
    finally:
        db.close()
