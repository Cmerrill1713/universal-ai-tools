"""
Prometheus /metrics endpoint for TRM router and evolution
"""
from fastapi import APIRouter, Response
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

# Import metrics from core
from src.core.metrics.prometheus_metrics import (
    ROUTING_DECISIONS,
    ROUTING_SUCCESS,
    ROUTING_ERRORS,
    ROUTING_LATENCY,
    TRM_PROMOTIONS,
    TRM_ACCURACY_DELTA,
    MODEL_INFERENCE_TIME,
    RAG_RETRIEVALS,
    RAG_DOCUMENTS_RETURNED
)

router = APIRouter()

@router.get("/metrics")
async def metrics_endpoint():
    """
    Prometheus metrics endpoint
    Exposes all TRM routing and evolution metrics
    """
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )


@router.get("/metrics/health")
async def metrics_health():
    """Health check for metrics endpoint"""
    return {
        "status": "healthy",
        "metrics_available": [
            "routing_decisions_total",
            "routing_success_total",
            "routing_errors_total",
            "routing_latency_ms",
            "trm_promotions_total",
            "trm_accuracy_delta",
            "model_inference_ms",
            "rag_retrievals_total",
            "rag_documents_returned"
        ]
    }

