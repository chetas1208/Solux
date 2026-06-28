from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from typing import Any, Generator

logger = logging.getLogger("solux")


@contextmanager
def timed_stage(metrics: dict[str, Any], key: str) -> Generator[None, None, None]:
    start = time.perf_counter()
    try:
        yield
    finally:
        metrics[key] = int((time.perf_counter() - start) * 1000)


def log_job_event(job_id: str, event: str, **kwargs: Any) -> None:
    logger.info("job=%s event=%s %s", job_id, event, kwargs)
