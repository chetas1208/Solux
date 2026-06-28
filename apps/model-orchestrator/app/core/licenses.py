from __future__ import annotations

WARN_PREFIXES = (
    "unknown",
    "detect_from",
    "warn",
)


def license_is_warning(status: str) -> bool:
    lowered = status.lower()
    return any(token in lowered for token in WARN_PREFIXES)


def license_warnings(status: str, model_id: str) -> list[str]:
    if license_is_warning(status):
        return [
            f"License/access for '{model_id}' is '{status}'. "
            "Verify model card before commercial or production use."
        ]
    return []
