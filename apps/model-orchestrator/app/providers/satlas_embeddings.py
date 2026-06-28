from __future__ import annotations

from app.providers.foundation_base import FoundationProvider


class SatlasProvider(FoundationProvider):
    hf_model_name = "allenai/satlas-pretrain"
