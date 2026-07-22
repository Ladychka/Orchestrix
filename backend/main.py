from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from threading import Thread
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.services.telegram_bot import start_bot, notify_approval_request
from app.api.api import api_router
from app.database import SessionLocal
from app.models.task import Task, TaskStatus
from app.models.approval import Approval, ApprovalStatus
from app.tools.log_task_step import log_task_step
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Run idempotent schema migrations
    try:
        from migrate import migrate

        migrate()
    except Exception as exc:
        print(f"[lifespan] Migration warning: {exc}")

    # 2. Start Telegram bot
    start_bot()

    # 3. Resume any tasks that were orphaned when the backend crashed
    _resume_orphaned_tasks()

    # 4. Start the approval watchdog thread
    watchdog_thread = Thread(target=_approval_watchdog_loop, daemon=True)
    watchdog_thread.start()

    yield


app = FastAPI(title="AI Employee Platform", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}


def _resume_orphaned_tasks():
    """Find tasks stuck in 'processing' (orphaned by a backend crash) and resume them."""
    db = SessionLocal()
    try:
        orphaned = (
            db.query(Task)
            .filter(Task.status == TaskStatus.processing)
            .filter(Task.conversation_state.isnot(None))
            .all()
        )
        if not orphaned:
            return

        print(f"[resume] Found {len(orphaned)} orphaned task(s) to resume.")
        from app.orchestrator.engine import run_task

        for task in orphaned:
            task.resumed_at = datetime.utcnow()
            db.commit()
            # FastAPI lifespan can't use BackgroundTasks, so we spawn threads.
            # In production this would be a proper worker queue (Redis/RQ/Celery).
            t = Thread(target=run_task, args=(task.id,), daemon=True)
            t.start()
            print(f"[resume] Spawned worker for task {task.id}")
    finally:
        db.close()


def _approval_watchdog_loop():
    """Background thread that re-notifies or auto-rejects stale approvals."""
    while True:
        time.sleep(300)  # check every 5 minutes
        try:
            _check_approval_timeouts()
        except Exception as exc:
            print(f"[watchdog] Error during timeout check: {exc}")


def _check_approval_timeouts():
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        timeout_delta = timedelta(hours=settings.APPROVAL_TIMEOUT_HOURS)
        escalation_delta = timedelta(hours=settings.APPROVAL_ESCALATION_HOURS)

        # --- Escalation: hard timeout → auto-reject ---
        stale = (
            db.query(Task)
            .join(Approval)
            .filter(Task.status == TaskStatus.awaiting_approval)
            .filter(Approval.status == ApprovalStatus.pending)
            .filter(Approval.requested_at < now - escalation_delta)
            .all()
        )
        for task in stale:
            approval = task.approval
            approval.status = ApprovalStatus.rejected
            approval.resolved_at = now
            approval.resolved_by = "system (timeout)"
            task.status = TaskStatus.rejected
            db.commit()

            log_task_step(
                task.id,
                {
                    "step_number": len(task.steps),
                    "tool_called": "reject_approval",
                    "tool_input": {},
                    "tool_output": {
                        "status": "rejected",
                        "reason": f"Timed out after {settings.APPROVAL_ESCALATION_HOURS} hours with no response.",
                    },
                },
            )
            print(f"[watchdog] Auto-rejected task {task.id} after {settings.APPROVAL_ESCALATION_HOURS}h")

        # --- First escalation: reminder ---
        remind = (
            db.query(Task)
            .join(Approval)
            .filter(Task.status == TaskStatus.awaiting_approval)
            .filter(Approval.status == ApprovalStatus.pending)
            .filter(Approval.requested_at < now - timeout_delta)
            .filter(Approval.last_notified_at.is_(None))
            .all()
        )
        for task in remind:
            approval = task.approval
            # Build a reminder summary from the last approval step
            summary = "Approval reminder: quotation is awaiting your decision."
            draft_step = next(
                (s for s in reversed(task.steps) if s.tool_called == "draft_quotation_email"),
                None,
            )
            if draft_step and draft_step.tool_output:
                out = draft_step.tool_output
                if isinstance(out, dict):
                    summary = out.get("text", summary)
                elif isinstance(out, str):
                    summary = out

            notify_approval_request(task.id, f"[REMINDER] {summary}")
            approval.last_notified_at = now
            db.commit()
            print(f"[watchdog] Reminder sent for task {task.id}")
    finally:
        db.close()
