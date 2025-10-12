"""
Prometheus metrics for TRM routing and evolution
Export via /metrics endpoint
"""
from prometheus_client import Counter, Histogram, Gauge
import time

# Routing decisions
ROUTING_DECISIONS = Counter(
    "routing_decisions_total",
    "Total routing decisions made",
    ["model", "route", "engine"]
)

ROUTING_SUCCESS = Counter(
    "routing_success_total",
    "Successful routing decisions"
)

ROUTING_ERRORS = Counter(
    "routing_errors_total",
    "Failed routing decisions",
    ["error_type"]
)

# Latency tracking
ROUTING_LATENCY = Histogram(
    "routing_latency_ms",
    "Routing decision latency in milliseconds",
    buckets=[50, 100, 200, 400, 800, 1200, 1600, 2000, 3000, 5000]
)

# TRM evolution metrics
TRM_PROMOTIONS = Counter(
    "trm_promotions_total",
    "TRM model promotions to production"
)

TRM_ACCURACY_DELTA = Gauge(
    "trm_accuracy_delta",
    "TRM accuracy improvement delta",
    ["delta_type"]
)

TRM_TRAINING_TIME = Histogram(
    "trm_training_duration_seconds",
    "TRM training duration",
    buckets=[60, 300, 600, 1200, 1800, 3600]
)

# Model performance
MODEL_INFERENCE_TIME = Histogram(
    "model_inference_ms",
    "Model inference time",
    ["model", "task_type"],
    buckets=[10, 50, 100, 200, 500, 1000, 2000, 5000]
)

# RAG metrics
RAG_RETRIEVALS = Counter(
    "rag_retrievals_total",
    "RAG document retrievals",
    ["success"]
)

RAG_DOCUMENTS_RETURNED = Histogram(
    "rag_documents_returned",
    "Number of documents returned per RAG query",
    buckets=[1, 3, 5, 10, 20, 50]
)


# Helper functions
def record_routing_decision(model: str, route: str, engine: str, latency_ms: float, success: bool):
    """Record a routing decision with all metrics"""
    ROUTING_DECISIONS.labels(model=model, route=route, engine=engine).inc()
    if success:
        ROUTING_SUCCESS.inc()
    else:
        ROUTING_ERRORS.labels(error_type="execution_failed").inc()
    ROUTING_LATENCY.observe(latency_ms)


def record_trm_promotion(baseline_acc: float, candidate_acc: float):
    """Record a TRM model promotion"""
    TRM_PROMOTIONS.inc()
    delta = candidate_acc - baseline_acc
    TRM_ACCURACY_DELTA.labels(delta_type="route_accuracy").set(delta)


def record_model_inference(model: str, task_type: str, duration_ms: float):
    """Record model inference time"""
    MODEL_INFERENCE_TIME.labels(model=model, task_type=task_type).observe(duration_ms)


def record_rag_retrieval(success: bool, num_docs: int):
    """Record RAG retrieval"""
    RAG_RETRIEVALS.labels(success="true" if success else "false").inc()
    if success:
        RAG_DOCUMENTS_RETURNED.observe(num_docs)


# Example usage in router
"""
from src.core.metrics.prometheus_metrics import record_routing_decision

# After routing execution
record_routing_decision(
    model=selected_model_name,
    route=policy.route,
    engine=policy.engine,
    latency_ms=latency_ms,
    success=execution_success
)
"""

