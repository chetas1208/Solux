from __future__ import annotations

from typing import Any

import httpx

from app.config import Settings


class MaxLocalCriticProvider:
    """OpenAI-compatible client for local Modular/MAX critic — never calls external APIs."""

    def __init__(self, settings: Settings) -> None:
        self.base_url = settings.max_critic_base_url.rstrip("/")
        self.timeout = settings.max_critic_timeout_seconds
        self.last_warnings: list[str] = []

    def _chat(self, system: str, user: str) -> str:
        self.last_warnings = []
        url = f"{self.base_url}/v1/chat/completions"
        payload = {
            "model": "local-critic",
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.2,
            "max_tokens": 1024,
        }
        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"]
        except httpx.HTTPError as exc:
            self.last_warnings.append(f"MAX critic unavailable: {exc}")
            return ""

    def is_available(self) -> bool:
        try:
            with httpx.Client(timeout=5.0) as client:
                r = client.get(f"{self.base_url}/v1/health")
                return r.status_code == 200
        except httpx.HTTPError:
            try:
                with httpx.Client(timeout=5.0) as client:
                    r = client.get(f"{self.base_url}/v1/models")
                    return r.status_code == 200
            except httpx.HTTPError:
                return False

    def critique_detection_result(self, *, result: dict[str, Any], prompt: str | None = None) -> str:
        system = "You explain geospatial solar detection results. Never override hard fatal-flaw constraints."
        user = prompt or f"Explain this detection result:\n{result}"
        return self._chat(system, user)

    def explain_routing_decision(self, *, decision: dict[str, Any]) -> str:
        return self._chat(
            "Explain model routing decisions for a solar site analysis platform.",
            f"Routing decision:\n{decision}",
        )

    def rerank_candidates_with_reasoning(
        self, *, candidates: list[dict[str, Any]], prompt: str | None = None
    ) -> str:
        return self._chat(
            "Explain candidate ranking. Do not override hard constraints.",
            prompt or f"Candidates:\n{candidates}",
        )

    def generate_site_report(self, *, structured: dict[str, Any], prompt: str | None = None) -> str:
        return self._chat(
            "Write a site analysis report. Every claim must map to structured fields provided.",
            prompt or f"Structured data:\n{structured}",
        )
