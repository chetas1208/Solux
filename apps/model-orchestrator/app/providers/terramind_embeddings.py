from __future__ import annotations

from app.providers.foundation_base import FoundationProvider


class TerraMindProvider(FoundationProvider):
    hf_model_name = "ibm-esa-geospatial/TerraMind-1.0-base"
