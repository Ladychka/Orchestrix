"""Ollama chat client with tool-calling support + text-parsing fallback."""

import json
import re
from typing import Any

import requests

from app.core.config import settings

OLLAMA_CHAT_URL = f"{settings.OLLAMA_URL.rstrip('/')}/api/chat"
MODEL_NAME = settings.OLLAMA_MODEL


def _convert_declarations(declarations: list[dict]) -> list[dict]:
    """Convert our FUNCTION_DECLARATIONS to Ollama/OpenAI tool format."""
    tools = []
    for decl in declarations:
        tools.append({
            "type": "function",
            "function": {
                "name": decl["name"],
                "description": decl["description"],
                "parameters": decl.get("parameters", {}),
            },
        })
    return tools


def _extract_tool_call(text: str) -> dict[str, Any] | None:
    """Fallback: parse a tool call from raw model text."""
    # Look for JSON blocks or inline JSON with tool/args keys
    patterns = [
        r'```json\s*(\{.*?\})\s*```',
        r'```\s*(\{.*?\})\s*```',
        r'\{\s*"tool"\s*:.*\}',
    ]
    for pat in patterns:
        for match in re.finditer(pat, text, re.DOTALL):
            try:
                data = json.loads(match.group(1) if match.groups() else match.group(0))
                if "tool" in data or "name" in data:
                    # Normalize to Ollama tool_call shape
                    tool_name = data.get("tool") or data.get("name")
                    args = data.get("args") or data.get("arguments") or data.get("parameters") or {}
                    return {
                        "function": {
                            "name": tool_name,
                            "arguments": args,
                        }
                    }
            except Exception:
                continue
    return None


def chat(
    messages: list[dict[str, Any]],
    tools: list[dict] | None = None,
    stream: bool = False,
) -> dict[str, Any]:
    """Send a chat request to Ollama and return the message + optional tool_calls.

    Returns:
        {"content": str, "tool_calls": list[dict] | None}
    """
    ollama_tools = _convert_declarations(tools) if tools else None

    payload = {
        "model": MODEL_NAME,
        "messages": messages,
        "stream": stream,
    }
    if ollama_tools:
        payload["tools"] = ollama_tools

    try:
        resp = requests.post(OLLAMA_CHAT_URL, json=payload, timeout=120)
        resp.raise_for_status()
    except requests.exceptions.ConnectionError as exc:
        raise RuntimeError(
            f"Cannot connect to Ollama at {settings.OLLAMA_URL}. "
            "If running inside Docker, use host.docker.internal:11434 instead of localhost."
        ) from exc
    except requests.exceptions.Timeout as exc:
        raise RuntimeError("Ollama request timed out after 120s.") from exc

    data = resp.json()
    message = data.get("message", {})

    content = message.get("content", "")
    tool_calls = message.get("tool_calls")

    # Fallback: if Ollama didn't return structured tool_calls but the text looks
    # like a JSON tool invocation, parse it manually.
    if not tool_calls and content:
        parsed = _extract_tool_call(content)
        if parsed:
            tool_calls = [parsed]

    return {
        "content": content,
        "tool_calls": tool_calls,
    }
