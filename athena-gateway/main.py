#!/usr/bin/env python3
"""
Athena API Gateway - Central hub for all AI services
Routes all requests through Athena's unified system
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx
import logging
import time
from typing import Dict, Any, Optional
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Athena API Gateway",
    description="Central hub for all AI services, routing through Athena",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS for all interfaces
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Service URLs
SERVICES = {
    "athena-api": "http://athena-api:8000",
    "athena-evolutionary": "http://athena-evolutionary:8004",
    "athena-knowledge-gateway": "http://athena-knowledge-gateway:8080",
    "athena-knowledge-context": "http://athena-knowledge-context:8080",
    "athena-knowledge-sync": "http://athena-knowledge-sync:8080",
    "athena-weaviate": "http://athena-weaviate:8080",
    "athena-searxng": "http://athena-searxng:8080"
}

# Request/Response Models
class ChatRequest(BaseModel):
    message: str
    model: Optional[str] = "llama3.2:3b"
    context: Optional[Dict[str, Any]] = None

class EvolutionRequest(BaseModel):
    task: str
    context: Optional[Dict[str, Any]] = None
    orchestration_mode: Optional[str] = "dspy"

class KnowledgeRequest(BaseModel):
    query: str
    filters: Optional[Dict[str, Any]] = None
    limit: Optional[int] = 10

class HealthResponse(BaseModel):
    status: str
    services: Dict[str, str]
    timestamp: float

# Health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check health of all services"""
    service_status = {}
    
    async with httpx.AsyncClient(timeout=5.0) as client:
        for service_name, service_url in SERVICES.items():
            try:
                response = await client.get(f"{service_url}/health")
                service_status[service_name] = "healthy" if response.status_code == 200 else "unhealthy"
            except Exception as e:
                service_status[service_name] = f"error: {str(e)}"
    
    overall_status = "healthy" if all(status == "healthy" for status in service_status.values()) else "degraded"
    
    return HealthResponse(
        status=overall_status,
        services=service_status,
        timestamp=time.time()
    )

# Chat endpoint - routes to Athena API
@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    """Route chat requests to Athena API"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{SERVICES['athena-api']}/api/chat",
                json=request.dict()
            )
            response.raise_for_status()
            return response.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Athena API timeout")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Athena API error: {e.response.text}")
    except Exception as e:
        logger.error(f"Chat endpoint error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

# Evolution endpoint - routes to Evolution API
@app.post("/api/evolution/analyze")
async def evolution_endpoint(request: EvolutionRequest):
    """Route evolution requests to Evolution API"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{SERVICES['athena-evolutionary']}/api/evolution/analyze",
                json=request.dict()
            )
            response.raise_for_status()
            return response.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Evolution API timeout")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Evolution API error: {e.response.text}")
    except Exception as e:
        logger.error(f"Evolution endpoint error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

# Knowledge search endpoint
@app.post("/api/knowledge/search")
async def knowledge_search(request: KnowledgeRequest):
    """Route knowledge requests to Knowledge Gateway"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{SERVICES['athena-knowledge-gateway']}/api/search",
                json=request.dict()
            )
            response.raise_for_status()
            return response.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Knowledge Gateway timeout")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Knowledge Gateway error: {e.response.text}")
    except Exception as e:
        logger.error(f"Knowledge search error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

# Knowledge context endpoint
@app.post("/api/knowledge/context")
async def knowledge_context(request: KnowledgeRequest):
    """Route context requests to Knowledge Context service"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{SERVICES['athena-knowledge-context']}/api/context",
                json=request.dict()
            )
            response.raise_for_status()
            return response.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Knowledge Context timeout")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Knowledge Context error: {e.response.text}")
    except Exception as e:
        logger.error(f"Knowledge context error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

# Web search endpoint
@app.post("/api/search/web")
async def web_search(request: KnowledgeRequest):
    """Route web search requests to SearXNG"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{SERVICES['athena-searxng']}/search",
                json=request.dict()
            )
            response.raise_for_status()
            return response.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Web search timeout")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Web search error: {e.response.text}")
    except Exception as e:
        logger.error(f"Web search error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

# Unified orchestration endpoint
@app.post("/api/orchestrate")
async def orchestrate(request: EvolutionRequest):
    """Unified orchestration through Athena Evolution System"""
    try:
        # First, analyze the task
        analysis_response = await evolution_endpoint(request)
        
        # Then, route to appropriate service based on analysis
        task_type = analysis_response.get("task_type", "general")
        
        if task_type == "chat":
            chat_request = ChatRequest(
                message=request.task,
                context=request.context
            )
            return await chat_endpoint(chat_request)
        elif task_type == "knowledge":
            knowledge_request = KnowledgeRequest(
                query=request.task,
                filters=request.context.get("filters") if request.context else None
            )
            return await knowledge_search(knowledge_request)
        else:
            # Default to evolution system
            return analysis_response
            
    except Exception as e:
        logger.error(f"Orchestration error: {e}")
        raise HTTPException(status_code=500, detail=f"Orchestration error: {str(e)}")

# Service discovery endpoint
@app.get("/api/services")
async def list_services():
    """List all available services"""
    return {
        "services": SERVICES,
        "gateway": "http://localhost:8080",
        "status": "operational"
    }

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with system information"""
    return {
        "name": "Athena API Gateway",
        "version": "1.0.0",
        "description": "Central hub for all AI services",
        "status": "operational",
        "endpoints": {
            "health": "/health",
            "chat": "/api/chat",
            "evolution": "/api/evolution/analyze",
            "knowledge": "/api/knowledge/search",
            "orchestrate": "/api/orchestrate",
            "services": "/api/services"
        },
        "documentation": "/docs"
    }

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "timestamp": time.time()
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "status_code": 500,
            "timestamp": time.time()
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)