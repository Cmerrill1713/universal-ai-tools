"""
FastAPI application with routers
"""

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

# Import routers (these will be available due to sitecustomize.py)
try:
    from api.routers import health, tasks, tts, users
except ImportError:
    from routers import health, tasks, users

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Universal AI Tools API",
    description="Python API with path configuration demo",
    version="1.0.0"
)

# Error handling middleware
@app.middleware("http")
async def error_box(req: Request, call_next):
    """Catch all unhandled exceptions and return proper JSON"""
    try:
        return await call_next(req)
    except Exception as e:
        logger.error(f"Unhandled exception: {type(e).__name__}: {e}", exc_info=True)
        
        # Handle specific error types with appropriate status codes
        if isinstance(e, ValueError):
            return JSONResponse(
                {"error": "Validation Error", "detail": str(e)},
                status_code=422
            )
        elif isinstance(e, KeyError):
            return JSONResponse(
                {"error": "Missing Required Field", "detail": f"Missing field: {str(e)}"},
                status_code=422
            )
        elif isinstance(e, AttributeError):
            return JSONResponse(
                {"error": "Configuration Error", "detail": f"Missing method or attribute: {str(e)}"},
                status_code=500
            )
        elif isinstance(e, ConnectionError):
            return JSONResponse(
                {"error": "Service Unavailable", "detail": "External service is not available"},
                status_code=503
            )
        else:
            return JSONResponse(
                {"error": "Internal Server Error", "detail": str(e)},
                status_code=500
            )

# Include routers
app.include_router(health.router, tags=["health"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(tts.router, tags=["tts"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Universal AI Tools API",
        "version": "1.0.0",
        "status": "operational"
    }


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

