"""Re-export legacy routes under api namespace."""

from app.routes.health import router as health_router
from app.routes.inference import embed_router, rerank_router
from app.routes.models import router as models_router

__all__ = ["health_router", "models_router", "embed_router", "rerank_router"]
