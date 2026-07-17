"""AI Orchestrator — Gemini function-calling loop for the AI Finance Officer."""

import json
import traceback
from typing import Any

import google.generativeai as genai

from app.core.config import settings
from app.database import SessionLocal
from app.models.task import Task, TaskStatus
from app.models.approval import Approval, ApprovalStatus
from app.models.ai_employee import AIEmployee
from app.tools import check_inventory, calculate_quote, draft_quotation_email
from app.tools.log_task_step import log_task_step

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


def _args_to_dict(obj: Any) -> Any:
    """Recursively convert a protobuf Struct/MapComposite into plain Python dicts/lists."""
    if hasattr(obj, "items"):
        return {k: _args_to_dict(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_args_to_dict(v) for v in obj]
    return obj


def _build_system_prompt(employee: AIEmployee) -> str:
    return (
        f"You are {employee.name}, an AI employee with role '{employee.role}'.\n"
        f"Permissions: {json.dumps(employee.permissions)}\n"
        f"Connected tools: {json.dumps(employee.connected_tools)}\n\n"
        "WORKFLOW RULES:\n"
        "1. When you receive a quote request, first call check_inventory to verify the product exists and has stock.\n"
        "2. Then call calculate_quote with the exact SKU and quantity requested.\n"
        "3. Then call draft_quotation_email with the customer email and the quote result.\n"
        "4. Finally, call request_approval with a concise summary — NEVER call send_email directly.\n"
        "5. If a product is not found or out of stock, report that clearly in the summary.\n\n"
        "Follow the tools in order. Do not invent SKUs or prices."
    )


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

        task.status = TaskStatus.processing
        db.commit()

        payload = task.input_payload or {}
        email_body = payload.get("body", "")
        from_email = payload.get("from", "unknown@example.com")
        subject = payload.get("subject", "Quote request")

        system_prompt = _build_system_prompt(employee)
        user_text = f"From: {from_email}\nSubject: {subject}\n\n{email_body}"

        if not settings.GEMINI_API_KEY:
            print("[run_task] GEMINI_API_KEY missing; aborting.")
            task.status = TaskStatus.failed
            db.commit()
            return

        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(model_name="gemini-2.5-flash")

        contents = [
            {"role": "user", "parts": [{"text": system_prompt + "\n\n" + user_text}]}
        ]

        step_number = 0
        max_iterations = 8

        for iteration in range(max_iterations):
            try:
                response = model.generate_content(
                    contents,
                    tools=[{"function_declarations": FUNCTION_DECLARATIONS}],
                )
            except Exception as exc:
                print(f"[run_task] Gemini API error: {exc}")
                traceback.print_exc()
                task.status = TaskStatus.failed
                db.commit()
                return

            candidate = response.candidates[0]
            part = candidate.content.parts[0] if candidate.content.parts else None

            if part and part.function_call:
                fc = part.function_call
                tool_name = fc.name
                raw_args = fc.args
                args = _args_to_dict(raw_args)

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
                    contents.append(
                        {
                            "role": "model",
                            "parts": [
                                {"function_call": {"name": tool_name, "args": args}}
                            ],
                        }
                    )
                    contents.append(
                        {"role": "user", "parts": [{"text": f"Error: {error_msg}"}]}
                    )
                    step_number += 1
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
                    contents.append(
                        {
                            "role": "model",
                            "parts": [
                                {"function_call": {"name": tool_name, "args": args}}
                            ],
                        }
                    )
                    contents.append(
                        {"role": "user", "parts": [{"text": f"Error: {error_msg}"}]}
                    )
                    step_number += 1
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

                # Append model call and function result for next turn
                contents.append(
                    {
                        "role": "model",
                        "parts": [
                            {"function_call": {"name": tool_name, "args": args}}
                        ],
                    }
                )
                contents.append(
                    {
                        "role": "user",
                        "parts": [
                            {
                                "function_response": {
                                    "name": tool_name,
                                    "response": {"result": output},
                                }
                            }
                        ],
                    }
                )
                step_number += 1
                continue

            # No function call — final text response
            final_text = part.text if part else "No response."
            log_task_step(
                task.id,
                {
                    "step_number": step_number,
                    "tool_called": None,
                    "tool_input": {},
                    "tool_output": {"response": final_text},
                },
            )
            task.status = TaskStatus.completed
            db.commit()
            return

        # Exceeded max iterations
        task.status = TaskStatus.failed
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
