"""AI Orchestrator — Ollama chat loop for the AI Finance Officer.

Now resumable: conversation state (messages + step_number) is persisted to the
Task row after every tool call. If the backend crashes and restarts, orphaned
processing tasks are resumed from where they left off.
"""

import json
import traceback
from datetime import datetime
from typing import Any

from app.core.config import settings
from app.database import SessionLocal
from app.models.task import Task, TaskStatus
from app.models.approval import Approval, ApprovalStatus
from app.models.ai_employee import AIEmployee
from app.tools import check_inventory, calculate_quote, draft_quotation_email
from app.tools.log_task_step import log_task_step
from app.services import ollama_client

# Tool name → callable (exclude send_email — never call directly)
TOOL_MAP = {
    "check_inventory": check_inventory,
    "calculate_quote": calculate_quote,
    "draft_quotation_email": draft_quotation_email,
}

BANNED_TOOLS = {"send_email"}

FUNCTION_DECLARATIONS = [
    {
        "name": "check_inventory",
        "description": "Search the product inventory for items matching a query. Returns a list of products with stock and price.",
        "parameters": {
            "type": "object",
            "properties": {
                "product_query": {
                    "type": "string",
                    "description": "Product name, keyword, or SKU to search for.",
                }
            },
            "required": ["product_query"],
        },
    },
    {
        "name": "calculate_quote",
        "description": "Calculate a price quotation for a list of SKU/quantity pairs. Applies bulk discounts automatically.",
        "parameters": {
            "type": "object",
            "properties": {
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "sku": {"type": "string"},
                            "quantity": {"type": "integer"},
                        },
                        "required": ["sku", "quantity"],
                    },
                }
            },
            "required": ["items"],
        },
    },
    {
        "name": "draft_quotation_email",
        "description": "Draft a professional quotation email body given a quote result.",
        "parameters": {
            "type": "object",
            "properties": {
                "customer_email": {"type": "string"},
                "quote": {
                    "type": "object",
                    "description": "The quote dict returned by calculate_quote.",
                },
            },
            "required": ["customer_email", "quote"],
        },
    },
    {
        "name": "request_approval",
        "description": "Submit a quotation for human approval before sending it to the customer. ALWAYS use this instead of send_email.",
        "parameters": {
            "type": "object",
            "properties": {
                "summary": {
                    "type": "string",
                    "description": "A brief summary of the quote for the approver.",
                }
            },
            "required": ["summary"],
        },
    },
]


def _build_system_prompt(employee: AIEmployee) -> str:
    tools_json = json.dumps(FUNCTION_DECLARATIONS, indent=2)
    return (
        f"You are {employee.name}, an AI employee with role '{employee.role}'.\n"
        f"Permissions: {json.dumps(employee.permissions)}\n"
        f"Connected tools: {json.dumps(employee.connected_tools)}\n\n"
        "WORKFLOW RULES (STRICT ORDER):\n"
        "1. Call check_inventory with the exact SKU from the request (e.g. 'SKU-101').\n"
        "   - If results are returned, the product EXISTS. Proceed to step 2.\n"
        "   - Only skip to request_approval if the result list is EMPTY.\n"
        "2. Call calculate_quote with the exact SKU and quantity from the request.\n"
        "3. Call draft_quotation_email with the customer email and the quote result.\n"
        "4. Call request_approval with a concise summary — NEVER call send_email directly.\n"
        "5. If a product is truly not found (empty result), report that in the approval summary.\n\n"
        "Follow the tools in order. Do not invent SKUs or prices. Do not skip steps.\n\n"
        "You have access to the following tools. To call a tool, respond with a JSON object in this exact format:\n"
        '{"tool": "tool_name", "args": {"arg_name": "value", ...}}\n\n'
        f"Available tools:\n{tools_json}\n\n"
        "After each tool result is provided, continue with the next step in the workflow."
    )


def _persist_conversation_state(
    db,
    task: Task,
    messages: list[dict],
    step_number: int,
) -> None:
    """Save the in-memory Ollama conversation so we can resume after a crash."""
    task.conversation_state = {
        "messages": messages,
        "step_number": step_number,
    }
    db.commit()


def _clear_conversation_state(db, task: Task) -> None:
    """Wipe conversation state once a task reaches a terminal status."""
    task.conversation_state = None
    db.commit()


def run_task(task_id: int) -> None:
    db = SessionLocal()
    try:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            print(f"[run_task] Task {task_id} not found")
            return

        employee = db.query(AIEmployee).filter(AIEmployee.id == task.employee_id).first()
        if not employee:
            print(f"[run_task] Employee not found for task {task_id}")
            task.status = TaskStatus.failed
            db.commit()
            return

        # If this task was resumed from a crash, mark it.
        if task.conversation_state is not None:
            task.resumed_at = datetime.utcnow()

        payload = task.input_payload or {}
        email_body = payload.get("body", "")
        from_email = payload.get("from", "unknown@example.com")
        subject = payload.get("subject", "Quote request")

        system_prompt = _build_system_prompt(employee)
        user_text = f"From: {from_email}\nSubject: {subject}\n\n{email_body}"

        # Resume from persisted state if available, otherwise start fresh.
        if task.conversation_state:
            state = task.conversation_state
            messages = state.get("messages", [])
            step_number = state.get("step_number", 0)
            print(f"[run_task] Resuming task {task_id} at step {step_number}")
            # Ensure the task status reflects that work is happening again.
            if task.status != TaskStatus.processing:
                task.status = TaskStatus.processing
                db.commit()
        else:
            task.status = TaskStatus.processing
            db.commit()
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_text},
            ]
            step_number = 0

        max_iterations = 8

        for iteration in range(max_iterations):
            try:
                response = ollama_client.chat(
                    messages=messages,
                    tools=FUNCTION_DECLARATIONS,
                )
            except Exception as exc:
                print(f"[run_task] Ollama API error: {exc}")
                traceback.print_exc()
                task.status = TaskStatus.failed
                _clear_conversation_state(db, task)
                db.commit()
                return

            content = response.get("content", "")
            tool_calls = response.get("tool_calls")

            # Fallback: if the model returned a JSON tool call in plain text, parse it
            if not tool_calls and content.strip().startswith("{"):
                try:
                    parsed = json.loads(content.strip().split("\n")[0])
                    if "tool" in parsed or "name" in parsed:
                        tool_name = parsed.get("tool") or parsed.get("name")
                        args = parsed.get("args") or parsed.get("arguments") or {}
                        tool_calls = [{"function": {"name": tool_name, "arguments": args}}]
                except Exception:
                    pass

            # No tool call — final text response
            if not tool_calls:
                log_task_step(
                    task.id,
                    {
                        "step_number": step_number,
                        "tool_called": None,
                        "tool_input": {},
                        "tool_output": {"response": content},
                    },
                )
                task.status = TaskStatus.completed
                _clear_conversation_state(db, task)
                db.commit()
                return

            # Process the first tool call
            tc = tool_calls[0]
            func = tc.get("function", {})
            tool_name = func.get("name")
            raw_args = func.get("arguments", {})

            # Normalize args to dict
            if isinstance(raw_args, str):
                try:
                    args = json.loads(raw_args)
                except Exception:
                    args = {}
            else:
                args = raw_args or {}

            # Security gate: banned tools
            if tool_name in BANNED_TOOLS:
                error_msg = f"Tool '{tool_name}' is banned. Use request_approval instead."
                log_task_step(
                    task.id,
                    {
                        "step_number": step_number,
                        "tool_called": tool_name,
                        "tool_input": args,
                        "tool_output": {"error": error_msg},
                    },
                )
                messages.append({"role": "assistant", "content": content or json.dumps(tc)})
                messages.append({"role": "user", "content": f"Error: {error_msg}"})
                step_number += 1
                _persist_conversation_state(db, task, messages, step_number)
                continue

            # Special tool: request_approval
            if tool_name == "request_approval":
                summary = args.get("summary", "Approval requested.")
                _create_approval_record(task.id, summary, db)
                log_task_step(
                    task.id,
                    {
                        "step_number": step_number,
                        "tool_called": "request_approval",
                        "tool_input": args,
                        "tool_output": {"status": "awaiting_approval"},
                    },
                )
                task.status = TaskStatus.awaiting_approval
                _clear_conversation_state(db, task)
                db.commit()

                # Phase 5 notification hook
                try:
                    from app.services.telegram_bot import notify_approval_request

                    notify_approval_request(task.id, summary)
                except Exception:
                    pass  # Telegram may not be configured yet
                return

            # Execute mapped tool
            tool_fn = TOOL_MAP.get(tool_name)
            if not tool_fn:
                error_msg = f"Unknown tool: {tool_name}"
                log_task_step(
                    task.id,
                    {
                        "step_number": step_number,
                        "tool_called": tool_name,
                        "tool_input": args,
                        "tool_output": {"error": error_msg},
                    },
                )
                messages.append({"role": "assistant", "content": content or json.dumps(tc)})
                messages.append({"role": "user", "content": f"Error: {error_msg}"})
                step_number += 1
                _persist_conversation_state(db, task, messages, step_number)
                continue

            try:
                output = tool_fn(**args)
            except Exception as exc:
                traceback.print_exc()
                output = {"error": str(exc)}

            log_task_step(
                task.id,
                {
                    "step_number": step_number,
                    "tool_called": tool_name,
                    "tool_input": args,
                    "tool_output": output
                    if isinstance(output, (dict, list))
                    else {"result": output},
                },
            )

            # Feed result back to model
            result_text = json.dumps(output) if isinstance(output, (dict, list)) else str(output)
            messages.append({"role": "assistant", "content": content or f"Calling {tool_name}..."})
            messages.append(
                {"role": "user", "content": f"Tool '{tool_name}' returned:\n{result_text}\n\nContinue with the next step."}
            )
            step_number += 1
            _persist_conversation_state(db, task, messages, step_number)
            continue

        # Exceeded max iterations
        task.status = TaskStatus.failed
        _clear_conversation_state(db, task)
        db.commit()
        print(f"[run_task] Max iterations ({max_iterations}) exceeded for task {task_id}")

    finally:
        db.close()


def _create_approval_record(task_id: int, summary: str, db=None) -> None:
    """Create an Approval row for a task."""
    close_db = False
    if db is None:
        from app.database import SessionLocal

        db = SessionLocal()
        close_db = True
    try:
        approval = Approval(task_id=task_id, status=ApprovalStatus.pending)
        db.add(approval)
        db.commit()
    finally:
        if close_db:
            db.close()


def request_approval(task_id: int, summary: str) -> None:
    """Public helper to create an approval record (used by the orchestrator loop)."""
    _create_approval_record(task_id, summary)
