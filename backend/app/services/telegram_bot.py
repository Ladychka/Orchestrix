"""Telegram Bot service — approval workflow with inline Approve/Reject buttons."""

import asyncio
from datetime import datetime
from threading import Thread

from app.core.config import settings
from app.database import SessionLocal
from app.models.task import Task, TaskStatus
from app.models.approval import Approval, ApprovalStatus
from app.tools.send_email import send_email
from app.tools.log_task_step import log_task_step

_BOT_TOKEN = settings.TELEGRAM_BOT_TOKEN
_APPROVER_CHAT_ID = settings.TELEGRAM_APPROVER_CHAT_ID

_application = None
_bot_loop = None


def _get_telegram_classes():
    try:
        from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
        from telegram.ext import (
            Application,
            CommandHandler,
            CallbackQueryHandler,
            ContextTypes,
        )
        return Update, InlineKeyboardButton, InlineKeyboardMarkup, Application, CommandHandler, CallbackQueryHandler, ContextTypes
    except ImportError as exc:
        raise ImportError("python-telegram-bot is not installed") from exc


async def _start_cmd(update, context):
    await update.message.reply_text("AI Finance Officer approval bot ready.")


async def _approve_callback(update, context):
    _, InlineKeyboardButton, InlineKeyboardMarkup, Application, CommandHandler, CallbackQueryHandler, ContextTypes = _get_telegram_classes()

    query = update.callback_query
    await query.answer()

    data = query.data
    if not data.startswith("approve:"):
        return

    task_id = int(data.split(":")[1])

    db = SessionLocal()
    try:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task or task.status != TaskStatus.awaiting_approval:
            await query.edit_message_text("Task not found or already resolved.")
            return

        approval = task.approval
        if not approval or approval.status != ApprovalStatus.pending:
            await query.edit_message_text("Approval not found or already resolved.")
            return

        # Mark approved
        approval.status = ApprovalStatus.approved
        approval.resolved_at = datetime.utcnow()
        approval.resolved_by = query.from_user.username or str(query.from_user.id)
        task.status = TaskStatus.approved
        db.commit()

        # Reconstruct drafted email from task steps
        draft_step = next(
            (s for s in reversed(task.steps) if s.tool_called == "draft_quotation_email"),
            None,
        )
        email_body = ""
        if draft_step and draft_step.tool_output:
            email_body = draft_step.tool_output.get("result", "")
        if not email_body:
            email_body = "Your quotation is attached."

        customer_email = task.input_payload.get("from", "") if task.input_payload else ""
        subject = "Quotation from AI Finance Officer"

        # Send email
        success = send_email(customer_email, subject, email_body)
        if success:
            task.status = TaskStatus.completed
            db.commit()
            log_task_step(
                task.id,
                {
                    "step_number": len(task.steps),
                    "tool_called": "send_email",
                    "tool_input": {"to": customer_email, "subject": subject},
                    "tool_output": {"sent": True},
                },
            )
            await query.edit_message_text(f"✅ Approved and email sent for task #{task_id}")
        else:
            task.status = TaskStatus.failed
            db.commit()
            await query.edit_message_text(
                f"⚠️ Approved but email failed for task #{task_id}"
            )
    finally:
        db.close()


async def _reject_callback(update, context):
    query = update.callback_query
    await query.answer()

    data = query.data
    if not data.startswith("reject:"):
        return

    task_id = int(data.split(":")[1])

    db = SessionLocal()
    try:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            await query.edit_message_text("Task not found.")
            return

        approval = task.approval
        if approval:
            approval.status = ApprovalStatus.rejected
            approval.resolved_at = datetime.utcnow()
            approval.resolved_by = query.from_user.username or str(query.from_user.id)

        task.status = TaskStatus.rejected
        db.commit()

        log_task_step(
            task.id,
            {
                "step_number": len(task.steps),
                "tool_called": "reject_approval",
                "tool_input": {},
                "tool_output": {"status": "rejected"},
            },
        )

        await query.edit_message_text(f"❌ Rejected task #{task_id}")
    finally:
        db.close()


def notify_approval_request(task_id: int, summary: str):
    """Send an approval request message to the configured approver chat."""
    if not _application or not _bot_loop or not _APPROVER_CHAT_ID:
        print(
            f"[telegram_bot] Cannot notify for task {task_id}: "
            "bot not running or approver chat ID missing."
        )
        return

    async def _send():
        from telegram import InlineKeyboardButton, InlineKeyboardMarkup

        keyboard = [
            [
                InlineKeyboardButton("✅ Approve", callback_data=f"approve:{task_id}"),
                InlineKeyboardButton("❌ Reject", callback_data=f"reject:{task_id}"),
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await _application.bot.send_message(
            chat_id=_APPROVER_CHAT_ID,
            text=f"🔔 Approval Request for Task #{task_id}\n\n{summary}",
            reply_markup=reply_markup,
        )

    asyncio.run_coroutine_threadsafe(_send(), _bot_loop)


def start_bot():
    """Start the Telegram bot polling loop in a background thread."""
    global _application, _bot_loop

    if not _BOT_TOKEN:
        print("[telegram_bot] No TELEGRAM_BOT_TOKEN configured; skipping bot start.")
        return

    try:
        from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
        from telegram.ext import (
            Application,
            CommandHandler,
            CallbackQueryHandler,
            ContextTypes,
        )
    except ImportError:
        print("[telegram_bot] python-telegram-bot not installed; skipping bot start.")
        return

    _application = Application.builder().token(_BOT_TOKEN).build()
    _application.add_handler(CommandHandler("start", _start_cmd))
    _application.add_handler(
        CallbackQueryHandler(_approve_callback, pattern=r"^approve:\d+$")
    )
    _application.add_handler(
        CallbackQueryHandler(_reject_callback, pattern=r"^reject:\d+$")
    )

    async def _run():
        global _bot_loop
        _bot_loop = asyncio.get_running_loop()
        await _application.initialize()
        await _application.start()
        await _application.updater.start_polling()
        # Block forever
        await asyncio.Event().wait()

    def run_in_thread():
        asyncio.run(_run())

    thread = Thread(target=run_in_thread, daemon=True)
    thread.start()
    print("[telegram_bot] Polling started in background thread.")
