from __future__ import annotations

from typing import Any

from app.harnesses.base_harness import BaseHarness
from app.providers.max_local_critic import MaxLocalCriticProvider


class CriticHarness(BaseHarness):
    model_key = "local_critic"

    def __init__(self, critic: MaxLocalCriticProvider) -> None:
        self.critic = critic

    def validate_input(self, **kwargs: Any) -> None:
        pass

    def run(self, **kwargs: Any) -> dict[str, Any]:
        method = kwargs.get("method", "critique")
        if method == "report":
            text = self.critic.generate_site_report(
                structured=kwargs.get("structured", {}),
                prompt=kwargs.get("prompt"),
            )
        elif method == "routing":
            text = self.critic.explain_routing_decision(
                decision=kwargs.get("decision", {}),
            )
        else:
            text = self.critic.critique_detection_result(
                result=kwargs.get("result", {}),
                prompt=kwargs.get("prompt"),
            )
        return {"explanation": text, "model": "local_critic", "warnings": self.critic.last_warnings}
