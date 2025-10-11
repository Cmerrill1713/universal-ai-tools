"""
Error handling middleware for FastAPI applications
Ensures all exceptions return proper JSON responses with error details
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)


def attach_error_mw(app: FastAPI):
    """
    Attach error handling middleware to a FastAPI app
    
    Usage:
        app = FastAPI()
        attach_error_mw(app)
    """
    @app.middleware("http")
    async def error_box(req: Request, call_next):
        try:
            return await call_next(req)
        except Exception as e:
            logger.error(
                f"Unhandled exception in {req.method} {req.url.path}: {type(e).__name__}: {e}",
                exc_info=True
            )
            return JSONResponse(
                {"error": type(e).__name__, "detail": str(e)}, 
                status_code=500
            )

