from __future__ import annotations

from app.providers.foundation_base import FoundationProvider


class DofaProvider(FoundationProvider):
    hf_model_name = "earthflow/DOFA"
