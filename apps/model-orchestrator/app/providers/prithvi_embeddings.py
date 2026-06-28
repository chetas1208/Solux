from __future__ import annotations

from app.config import Settings
from app.providers.foundation_base import FoundationProvider


class PrithviProvider(FoundationProvider):
    def __init__(
        self,
        settings: Settings,
        local_path: str,
        model_key: str,
        *,
        variant: str = "100m",
    ) -> None:
        super().__init__(settings, local_path, model_key)
        self.variant = variant
