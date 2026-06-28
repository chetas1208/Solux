from __future__ import annotations

from typing import Any


def run_fatal_flaw_screening(
    *,
    geometry: dict[str, Any] | None,
    bbox: list[float] | None,
    constraints: dict[str, Any],
) -> dict[str, Any]:
    """Rules/data-first fatal flaw screening — no foundation models."""
    warnings: list[str] = ["Fatal-flaw screening uses rules; connect real datasets for production."]
    flaws: list[dict[str, Any]] = []

    if constraints.get("avoidProtectedLand", True):
        flaws.append({
            "code": "protected_land_check",
            "status": "warn",
            "message": "Protected land overlap not verified — supply protected-area dataset",
        })
    if constraints.get("avoidUrbanCore", True):
        flaws.append({
            "code": "urban_conflict_check",
            "status": "warn",
            "message": "Urban/building conflict not verified — supply building footprint layer",
        })
    if constraints.get("preferNearTransmission", True):
        flaws.append({
            "code": "transmission_proximity",
            "status": "warn",
            "message": "Transmission proximity not computed — supply grid dataset",
        })

    slope_max = constraints.get("maxSlopeDeg", 0)
    if slope_max and slope_max > 0:
        flaws.append({
            "code": "slope_check",
            "status": "warn",
            "message": f"Slope threshold {slope_max}° configured but DEM not supplied",
        })

    if not geometry and not bbox:
        flaws.append({
            "code": "missing_geometry",
            "status": "fail",
            "message": "geometry or bbox required for site screening",
        })

    hard_fail = any(f["status"] == "fail" for f in flaws)
    return {
        "fatalFlaws": flaws,
        "scores": {"pass": not hard_fail, "warnCount": sum(1 for f in flaws if f["status"] == "warn")},
        "warnings": warnings,
    }
