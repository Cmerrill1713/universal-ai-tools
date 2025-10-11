"""
Prometheus metrics middleware for FastAPI
Provides request counting, latency tracking, and status code monitoring
"""
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from fastapi import FastAPI, Request, Response
from fastapi.responses import Response as FastAPIResponse
import time

# Metrics
REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

REQUEST_LATENCY = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint']
)

def attach_metrics(app: FastAPI):
    """Attach Prometheus metrics middleware to FastAPI app"""
    
    @app.middleware("http")
    async def prometheus_middleware(request: Request, call_next):
        """Track metrics for each request"""
        # Start timer
        start_time = time.time()
        
        # Process request
        response = await call_next(request)
        
        # Calculate latency
        latency = time.time() - start_time
        
        # Extract endpoint (remove query params, IDs)
        endpoint = request.url.path
        
        # Record metrics
        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=endpoint,
            status=response.status_code
        ).inc()
        
        REQUEST_LATENCY.labels(
            method=request.method,
            endpoint=endpoint
        ).observe(latency)
        
        return response
    
    @app.get("/metrics")
    async def metrics():
        """Expose Prometheus metrics"""
        return Response(
            content=generate_latest(),
            media_type=CONTENT_TYPE_LATEST
        )

