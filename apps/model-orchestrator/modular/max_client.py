"""HTTP client helpers for local Modular/MAX OpenAI-compatible endpoint."""

from __future__ import annotations

from typing import Any

import httpx


def chat_completion(
    base_url: str,
    messages: list[dict[str, str]],
    *,
    timeout: float = 60.0,
    max_tokens: int = 1024,
) -> dict[str, Any]:
    url = f"{base_url.rstrip('/')}/v1/chat/completions"
    payload = {
        "model": "local-critic",
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": max_tokens,
    }
    with httpx.Client(timeout=timeout) as client:
        resp = client.post(url, json=payload)
        resp.raise_for_status()
        return resp.json()
