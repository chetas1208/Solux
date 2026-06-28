from __future__ import annotations

from typing import Any


def run_water_solar_screening(
    *,
    job_type: str,
    geometry: dict[str, Any] | None,
    constraints: dict[str, Any],
) -> dict[str, Any]:
    warnings = [f"{job_type} screening uses rules-first pipeline"]
    results: dict[str, Any] = {"features": [], "scores": {}, "fatalFlaws": []}

    water_type = {
        "floating_solar": "open_water",
        "canal_solar": "canal",
        "reservoir_solar": "reservoir",
    }.get(job_type, "water")

    results["scores"] = {
        "waterbodyType": water_type,
        "suitability": "unknown",
    }
    if not geometry:
        results["fatalFlaws"].append({
            "code": "missing_water_geometry",
            "status": "fail",
            "message": "Waterbody/canal/reservoir geometry required",
        })
    if constraints.get("avoidProtectedLand", True):
        warnings.append("Protected-area exclusion not verified without dataset")

    return {"results": results, "warnings": warnings}
