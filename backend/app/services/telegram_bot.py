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
            out = draft_step.tool_output
            if isinstance(out, dict):
                email_body = out
            elif isinstance(out, str):
                email_body = out
            else:
                email_body = "Your quotation is attached."
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
            await query.edit_message_text(
                f"✅ <b>Task #{task_id} Approved</b>\n\n"
                f"The quotation has been approved and the email has been sent to the customer.",
                parse_mode="HTML",
            )
        else:
            task.status = TaskStatus.failed
            db.commit()
            await query.edit_message_text(
                f"⚠️ <b>Task #{task_id} — Email Failed</b>\n\n"
                f"Approved successfully, but the email could not be sent. Please check SMTP settings.",
                parse_mode="HTML",
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

        await query.edit_message_text(
            f"❌ <b>Task #{task_id} Rejected</b>\n\n"
            f"The quotation was rejected. No email was sent to the customer.",
            parse_mode="HTML",
        )
    finally:
        db.close()


def _format_telegram_summary(raw_summary: str) -> str:
    """Parse the LLM summary into structured bullet points for Telegram HTML."""
    import re

    text = raw_summary.strip()
    bullets = []

    # Extract email
    email_match = re.search(r'([\w.-]+@[\w.-]+\.[A-Za-z]{2,})', text)
    if email_match:
        bullets.append(f"• 👤 Customer: <b>{email_match.group(1)}</b>")

    # Extract product + SKU — pattern: "X units of Product (SKU-YYY)" or "Product (SKU-YYY)"
    product_match = re.search(r'(\d+)\s+units?\s+of\s+([^(]+)\s*\((SKU-\d+)\)', text, re.IGNORECASE)
    if product_match:
        qty = product_match.group(1)
        product = product_match.group(2).strip()
        sku = product_match.group(3)
        bullets.append(f"• 📦 Product: <b>{product}</b> (<b>{sku}</b>)")
        bullets.append(f"• 📊 Quantity: <b>{qty} units</b>")
    else:
        # Fallback: just extract SKU
        sku_match = re.search(r'(SKU-\d+)', text)
        if sku_match:
            bullets.append(f"• 🏷️ SKU: <b>{sku_match.group(1)}</b>")

    # Extract unit price
    unit_price_match = re.search(r'[Uu]nit\s+price\s+[:$]?\s*(\$[\d,.]+)', text)
    if unit_price_match:
        bullets.append(f"• 💵 Unit Price: <code>{unit_price_match.group(1)}</code>")

    # Extract discount
    discount_match = re.search(r'[Dd]iscount\s+[:$]?\s*(\$[\d,.]+(?:\.\d{2})?)', text)
    if discount_match:
        bullets.append(f"• 🏷️ Bulk Discount: <code>-{discount_match.group(1)}</code>")

    # Extract total — pattern: "Total: $X" or "total $X USD"
    total_match = re.search(r'[Tt]otal[:\s]+(\$[\d,.]+(?:\.\d{2})?)\s*(USD)?', text)
    if total_match:
        currency = total_match.group(2) or "USD"
        bullets.append(f"• 💰 Total: <code>{total_match.group(1)} {currency}</code>")

    # Extract stock/note warning
    note_match = re.search(r'[Nn]ote[:\s]+(.+?)(?:\.|$)', text)
    if note_match:
        note_text = note_match.group(1).strip()
        bullets.append(f"\n⚠️ <b>Warning:</b> {note_text}")
    elif re.search(r'stock\s+is\s+(?:only\s+)?(\d+)', text, re.IGNORECASE):
        stock_num = re.search(r'stock\s+is\s+(?:only\s+)?(\d+)', text, re.IGNORECASE).group(1)
        bullets.append(f"\n⚠️ <b>Stock Alert:</b> Only {stock_num} units available in inventory.")

    # If we couldn't parse anything, fall back to the original text as a single bullet
    if not bullets:
        text = re.sub(r'(\$[\d,]+\.\d{2})', r'<code>\1</code>', text)
        text = re.sub(r'(SKU-\d+)', r'<b>\1</b>', text)
        text = re.sub(r'([\w.-]+@[\w.-]+\.[A-Za-z]{2,})', r'<b>\1</b>', text)
        return f"• {text}"

    return "\n".join(bullets)


def notify_approval_request(task_id: int, summary: str):
    """Send a beautifully formatted approval request message to the configured approver chat."""
    if not _application or not _bot_loop or not _APPROVER_CHAT_ID:
        print(
            f"[telegram_bot] Cannot notify for task {task_id}: "
            "bot not running or approver chat ID missing."
        )
        return

    async def _send():
        from telegram import InlineKeyboardButton, InlineKeyboardMarkup

        formatted = _format_telegram_summary(summary)

        message = (
            f"🔔 <b>APPROVAL REQUEST — Task #{task_id}</b>\n"
            f"━━━━━━━━━━━━━━━━━━━━\n\n"
            f"📋 <b>Quotation Summary</b>\n"
            f"{formatted}\n\n"
            f"━━━━━━━━━━━━━━━━━━━━\n\n"
            f"<i>Please choose an action:</i>"
        )

        keyboard = [
            [
                InlineKeyboardButton("✅ Approve & Send", callback_data=f"approve:{task_id}"),
                InlineKeyboardButton("❌ Reject", callback_data=f"reject:{task_id}"),
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)

        await _application.bot.send_message(
            chat_id=_APPROVER_CHAT_ID,
            text=message,
            reply_markup=reply_markup,
            parse_mode="HTML",
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
